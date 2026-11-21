"""Optional document SER adapter; local-only weights and first-subtoken decoding."""
from __future__ import annotations
import io
from pathlib import Path
from ...config import settings
_engine = None
_load_error = None

def _model_cached(model_id: str) -> bool:
    if not model_id:
        return False
    local = Path(model_id)
    roots = [local] if local.is_dir() else list((Path(settings.models_cache_path) / ('models--' + model_id.replace('/', '--')) / 'snapshots').glob('*'))
    return any((p / 'config.json').is_file() and (any(p.glob('*.safetensors')) or (p / 'pytorch_model.bin').is_file()) for p in roots)

def model_cached(): return _model_cached(settings.SER_MODEL)
def is_loaded(): return _engine is not None

def _get_engine():
    global _engine, _load_error
    if _engine is not None or _load_error is not None:
        return _engine
    if not model_cached():
        _load_error = '模型权重尚未配置；继续使用OCR和规则复核'
        return None
    try:
        from transformers import AutoModelForTokenClassification, AutoProcessor
        processor = AutoProcessor.from_pretrained(settings.SER_MODEL, cache_dir=settings.models_cache_path, apply_ocr=False, local_files_only=True)
        model = AutoModelForTokenClassification.from_pretrained(settings.SER_MODEL, cache_dir=settings.models_cache_path, local_files_only=True)
        labels = list(model.config.id2label.values())
        if not any('QUESTION' in str(x).upper() for x in labels):
            raise ValueError('检查点缺少可识别的BIO标签映射')
        model.eval()
        _engine = SEREngine(processor, model)
    except Exception as exc:
        _load_error = f'SER加载失败（{type(exc).__name__}）'
    return _engine

def ser_available(): return bool(settings.SER_ENABLED and _get_engine() is not None)
def ser_load_error():
    if settings.SER_ENABLED: _get_engine()
    return _load_error

def word_windows(tokenizer, texts, limit=510):
    """Keep every OCR word without exceeding a model's text token budget."""
    start = 0
    size = 0
    for i, text in enumerate(texts):
        count = len(tokenizer([text], add_special_tokens=False)['input_ids'])
        count = max(count, 1)
        if count > limit:
            raise ValueError('单个OCR词条超过模型文本长度，请先拆分词条')
        if size + count > limit:
            yield start, i
            start, size = i, 0
        size += count
    if start < len(texts): yield start, len(texts)

def aggregate_entities(labels):
    entities, current = [], None
    for i, label in enumerate(labels):
        label = str(label).upper()
        ent = label[2:] if label.startswith(('B-', 'I-')) else None
        if ent and (label.startswith('B-') or current is None or current[0] != ent):
            if current: entities.append(current)
            current = (ent, [i])
        elif ent and current:
            current[1].append(i)
        else:
            if current: entities.append(current)
            current = None
    if current: entities.append(current)
    return entities

class SEREngine:
    name = 'Document-SER'
    def __init__(self, processor, model):
        self.processor, self.model = processor, model
        self.tokenizer = processor.tokenizer
        self.labels = {int(k): str(v).upper() for k, v in model.config.id2label.items()}

    def _forward_labels(self, image, texts, boxes):
        import torch
        import inspect
        result = ['O'] * len(texts)
        allowed = inspect.signature(self.model.forward).parameters
        for start, end in word_windows(self.tokenizer, texts):
            enc = self.processor(images=image, text=texts[start:end], boxes=boxes[start:end], truncation=True, max_length=512, padding='max_length', return_tensors='pt')
            word_ids = enc.word_ids(batch_index=0)
            values = dict(enc)
            if 'image' in allowed and 'pixel_values' in values:
                values['image'] = values.pop('pixel_values')
            values = {k: v for k, v in values.items() if k in allowed}
            with torch.inference_mode(): preds = self.model(**values).logits[0].argmax(-1).tolist()
            seen = set()
            for token_id, wid in enumerate(word_ids):
                if wid is not None and wid not in seen:
                    result[start + wid] = self.labels.get(preds[token_id], 'O')
                    seen.add(wid)
        return result

    @staticmethod
    def _entity(label):
        return label[2:] if label.startswith(('B-', 'I-')) else None

    def extract(self, image_bytes: bytes, words: list[dict]) -> list[dict]:
        from PIL import Image
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        width, height = image.size
        if not words: return []
        boxes = [[max(0, min(1000, int(round(v / (width if j % 2 == 0 else height) * 1000)))) for j, v in enumerate(w['box'])] for w in words]
        labels = self._forward_labels(image, [w['text'] for w in words], boxes)
        entities = aggregate_entities(labels)
        answers = [(ids, words[ids[0]]['box']) for kind, ids in entities if kind == 'ANSWER']
        pairs, used = [], set()
        for kind, ids in entities:
            if kind != 'QUESTION': continue
            q = words[ids[-1]]['box']
            candidates = []
            for a_ids, a in answers:
                if a_ids[0] in used: continue
                qh = max(q[3]-q[1], 1)
                same_line = abs((a[1]+a[3]-q[1]-q[3])/2) <= qh/2+8
                right = same_line and a[0] >= q[2]-5
                below = a[1] >= q[3]-2 and a[1]-q[3] <= 3*qh and abs(a[0]-q[0]) <= 3*qh
                if right or below:
                    dist = abs(a[0]-q[2]) + 2*abs(a[1]-q[1])
                    candidates.append((dist, a_ids))
            if not candidates: continue
            _, a_ids = min(candidates, key=lambda x: x[0]); used.add(a_ids[0])
            pairs.append({'question': ''.join(words[i]['text'] for i in ids), 'answer': ''.join(words[i]['text'] for i in a_ids), 'question_idx': ids[0], 'answer_idx': a_ids[0]})
        return pairs

__all__ = ['ser_available', 'ser_load_error', 'SEREngine', 'aggregate_entities', 'word_windows']
