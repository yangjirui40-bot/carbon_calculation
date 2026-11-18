import './HomeCapability.css'

const ITEMS = [
  {
    scope: 'Scope 1',
    title: '直接排放',
    desc: '设备柴油等实际耗用量，按活动数据与因子计算。',
  },
  {
    scope: 'Scope 2',
    title: '购入电力',
    desc: '按购电量核算，同一笔电费不重复计入采购。',
  },
  {
    scope: 'Scope 3',
    title: '采购商品与服务',
    desc: '以未税采购金额匹配排放强度，核算采购上游排放。',
  },
]

export default function HomeCapability() {
  return (
    <section className="home-capability">
      <div className="home-section-head">
        <h2>能力特色</h2>
      </div>
      <div className="home-cap-grid">
        {ITEMS.map((item) => (
          <article className="home-cap-item" key={item.scope}>
            <div className="home-cap-label">覆盖 / {item.scope}</div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
