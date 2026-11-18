import type { LineIconName } from '../../../components/common/LineIcon'
import LineIcon from '../../../components/common/LineIcon'
import './HomeProcess.css'

const STEPS: { no: string; title: string; desc: string; icon: LineIconName }[] = [
  { no: '01', title: '上传票据', desc: '图片或 PDF，单张票据保留原件。', icon: 'upload' },
  { no: '02', title: '识别 / 录入', desc: '自动识别字段，失败时可手工补录。', icon: 'scan' },
  { no: '03', title: '核对', desc: '低置信度有标记，确认后才参与计算。', icon: 'circle-check' },
  { no: '04', title: '核算与报告', desc: '按 Scope 汇总并生成可打印报告。', icon: 'pie' },
]

export default function HomeProcess() {
  return (
    <section className="home-process">
      <div className="home-section-head">
        <h2>工作方式</h2>
      </div>
      <div className="home-steps">
        {STEPS.map((step) => (
          <article className="home-step" key={step.no}>
            <div className="home-step-no">
              <span>{step.no}</span>
              <LineIcon name={step.icon} size={15} />
            </div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
