"""Train/evaluate document SER on disjoint XFUND-like datasets; no claimed scores."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
LABELS = ['O', 'B-QUESTION', 'I-QUESTION', 'B-ANSWER', 'I-ANSWER', 'B-HEADER', 'I-HEADER']

def normalize_label(label):
    label = str(label).upper()
    if label in ('OTHER', 'OTHERS', 'O'): return 'O'
    if label in ('QUESTION', 'ANSWER', 'HEADER'): return 'B-' + label
    if label not in LABELS: raise ValueError('未知标签：' + label)
    return label

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--data', required=True)
    p.add_argument('--out', default='./models/ser_zh')
    p.add_argument('--base-model', default='microsoft/layoutlmv3-base-chinese')
    p.add_argument('--epochs', type=float, default=10)
    p.add_argument('--batch-size', type=int, default=2)
    p.add_argument('--lr', type=float, default=2e-5)
    p.add_argument('--evaluate-only', action='store_true')
    p.add_argument('--register-company', type=int, help='成功后把检查点及验证集摘要登记到指定企业')
    args = p.parse_args()
    import numpy as np
    import torch
    from PIL import Image
    from transformers import AutoProcessor, AutoModelForTokenClassification, Trainer, TrainingArguments, default_data_collator
    from seqeval.metrics import precision_score, recall_score, f1_score
    from .ser import word_windows
    root, output = Path(args.data).resolve(), Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    label2id = {x: i for i, x in enumerate(LABELS)}
    processor = AutoProcessor.from_pretrained(args.base_model, apply_ocr=False)
    if args.evaluate_only:
        model = AutoModelForTokenClassification.from_pretrained(args.base_model)
    else:
        model = AutoModelForTokenClassification.from_pretrained(args.base_model, num_labels=len(LABELS), label2id=label2id, id2label={v: k for k, v in label2id.items()}, ignore_mismatched_sizes=True)
    id2label = {int(k): normalize_label(v) for k,v in model.config.id2label.items()}
    label2id = {v:k for k,v in id2label.items()}
    if set(label2id) != set(LABELS):
        raise ValueError('模型标签必须包含O及QUESTION/ANSWER/HEADER的BIO标签')
    hashes = {}
    counts = {}
    def load(split):
        source = root / (split+'.json')
        documents = json.loads(source.read_text(encoding='utf-8'))['documents']
        rows, image_hashes = [], set()
        for doc in documents:
            filename = doc['img']['fname']
            image_path = (root/filename).resolve()
            if not image_path.is_relative_to(root): raise ValueError('图像路径越界')
            image_hashes.add(hashlib.sha256(image_path.read_bytes()).hexdigest())
            image = Image.open(image_path).convert('RGB')
            width, height = image.size
            words, boxes, labels = [], [], []
            for entity in doc['document']:
                items = entity.get('words') or [{'text':entity['text'], 'box':entity['box']}]
                kind = normalize_label(entity['label'])
                for i, word in enumerate(items):
                    if not word.get('text','').strip(): continue
                    box = word['box']
                    if len(box) != 4 or box[2] < box[0] or box[3] < box[1]: raise ValueError('无效边界框')
                    boxes.append([max(0,min(1000,int(round(v/(width if j%2==0 else height)*1000)))) for j,v in enumerate(box)])
                    words.append(word['text'])
                    label = 'I-'+kind[2:] if i and kind.startswith('B-') else kind
                    labels.append(label2id[label])
            for a,b in word_windows(processor.tokenizer, words):
                enc=processor(images=image,text=words[a:b],boxes=boxes[a:b],word_labels=labels[a:b],padding='max_length',truncation=True,max_length=512,return_tensors='pt')
                row={k:v[0] for k,v in enc.items()}
                if len(row['labels']) != len(row['input_ids']): raise ValueError('标签未与子词对齐')
                rows.append(row)
        hashes[split] = image_hashes
        counts[split] = {'documents':len(documents),'windows':len(rows),'annotation_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
        return rows
    train = [] if args.evaluate_only else load('zh_train')
    validation = load('zh_val')
    if not args.evaluate_only and hashes['zh_train'] & hashes['zh_val']: raise ValueError('训练与验证图像重复，拒绝数据泄漏')
    if not validation or (not args.evaluate_only and not train):
        raise ValueError('训练与验证模式需要非空的数据分片')
    def metrics(prediction):
        predictions=np.argmax(prediction.predictions,axis=-1)
        y_true=[[id2label[int(v)] for v in row if v != -100] for row in prediction.label_ids]
        y_pred=[[id2label[int(v)] for v,l in zip(row, gold) if l != -100] for row,gold in zip(predictions,prediction.label_ids)]
        return {'entity_precision':precision_score(y_true,y_pred,zero_division=0),'entity_recall':recall_score(y_true,y_pred,zero_division=0),'entity_f1':f1_score(y_true,y_pred,zero_division=0)}
    kwargs=dict(output_dir=str(output),num_train_epochs=args.epochs,per_device_train_batch_size=args.batch_size,per_device_eval_batch_size=args.batch_size,learning_rate=args.lr,save_strategy='epoch' if train else 'no',logging_steps=20,remove_unused_columns=False,report_to=[],seed=42)
    import inspect
    key = 'eval_strategy' if 'eval_strategy' in inspect.signature(TrainingArguments).parameters else 'evaluation_strategy'
    kwargs[key]='epoch' if train else 'no'
    trainer=Trainer(model=model,args=TrainingArguments(**kwargs),train_dataset=train or None,eval_dataset=validation,data_collator=default_data_collator,compute_metrics=metrics)
    if train: trainer.train()
    result=trainer.evaluate()
    model.save_pretrained(output); processor.save_pretrained(output)
    manifest={'base_model':args.base_model,'dataset':counts,'metrics':result,'training_performed':bool(train),'cuda':torch.cuda.is_available(),'scope':'所提供验证集成绩；不代表真实企业票据效果','enable':'设置 SER_MODEL 为本目录，完成目标领域验证及许可核对后设置 SER_ENABLED=true'}
    from .model_registry import checkpoint_hash, record
    manifest["checkpoint_sha256"] = checkpoint_hash(output)
    manifest["trainer_sha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if args.register_company is not None:
        record(args.register_company,args,manifest)
    (output/'evaluation.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'output':str(output),'metrics':result},ensure_ascii=False))
if __name__=='__main__':main()
