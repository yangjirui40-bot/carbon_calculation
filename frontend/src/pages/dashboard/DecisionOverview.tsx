import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../../api'
import type { DashboardRing, Scope } from '../../api/types'
import type { DashboardData } from './types'
import { categoryLabel } from './swiss/labels'
import { precedingMonth, signedTonnes, tonnes } from './monitor'
import { formatPercent } from '../../utils/format'

type Props = {data: DashboardData; onScope: (scope: string, category?: string) => void}
const scopeLabels: Record<Scope, string> = {scope1:'直接排放',scope2:'外购能源',scope3:'价值链'}
const scopes: Scope[] = ['scope1','scope2','scope3']

export function StatusStrip({data}: Pick<Props,'data'>) {
  const {summary, budget} = data
  const previous = precedingMonth(data)
  const difference = previous ? summary.total_kgco2e - previous.total : null
  const budgetGap = budget.allocated_kgco2e === null ? null : budget.actual_kgco2e - budget.allocated_kgco2e
  const budgetState = {within:'预算内',over:'累计超预算',incomplete:'月份待补齐',unset:'未设预算'}[budget.status]
  return <section className="bi-strip" aria-label="排放状态">
    <div className="bi-lead"><span>本期核算排放</span>
      <div><strong>{summary.run_id ? tonnes(summary.total_kgco2e) : '暂无'}</strong> <small>tCO₂e</small></div>
      <footer>{summary.period || summary.periods?.join(' / ') || '暂无核算期间'}<i/>已纳入 {summary.record_count ?? 0} 条记录</footer>
    </div>
    <div className="bi-reading"><span>较上月变化</span><div><strong>{difference === null ? '不可比' : signedTonnes(difference)}</strong>{difference !== null && <small> tCO₂e</small>}</div>
      <footer>{previous ? `对比 ${previous.period} · ${previous.total > 0 ? formatPercent(difference! / previous.total) : '上期基数为零'}` : '需要相邻两个月的单月快照'}</footer></div>
    <div className="bi-reading"><span>{budget.year} 年累计预算</span><div><strong className={'bi-state '+budget.status}>{budgetState}</strong></div>
      <footer>{budgetGap === null ? '暂无可比预算额' : `${budgetGap > 0 ? '已超' : '距累计预算'} ${tonnes(Math.abs(budgetGap))} tCO₂e`} · 已核算 {budget.covered_months} 个月</footer></div>
  </section>
}

export function ReviewPanel({data, onShowActivities}: Pick<Props,'data'> & {onShowActivities: () => void}) {
  const {budget,trend,summary}=data
  const forecast=trend.forecast.find(p=>trend.monthly_budget_kgco2e!=null && p.period.startsWith(trend.budget_year+'-') && p.total>trend.monthly_budget_kgco2e)
  const prior = precedingMonth(data)
  const contributor = prior && scopes.map(scope => ({
    label: scopeLabels[scope], delta: summary.scope_breakdown[scope] - prior[scope],
  })).sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
  const notices: Array<{tag:string; title:string; reason:string; url:string; level:string}> = []
  if (budget.status==='over') notices.push({tag:'实绩',title:'累计排放超过分配预算',reason:`超出 ${tonnes(budget.actual_kgco2e-budget.allocated_kgco2e!)} tCO₂e`,url:'#bi-budget',level:'urgent'})
  if (forecast && summary.run_id) notices.push({tag:'预测',title:`${forecast.period} 预计突破月预算`,reason:`预计超出 ${tonnes(forecast.total-trend.monthly_budget_kgco2e!)} tCO₂e · 模拟减排`,url:'/simulator?run='+encodeURIComponent(summary.run_id),level:'watch'})
  if ((summary.excluded_count ?? 0)>0 && summary.run_id) notices.push({tag:'数据',title:`${summary.excluded_count} 条活动未纳入`,reason:'打开核算凭证，核对排除原因',url:'/audit/runs/'+encodeURIComponent(summary.run_id),level:'watch'})
  if (budget.covered_months<budget.elapsed_months) notices.push({tag:'覆盖',title:`年内缺 ${budget.elapsed_months-budget.covered_months} 个月核算`,reason:'检查盘查期间与关账记录',url:'/inventory',level:'watch'})
  if (budget.status==='unset') notices.push({tag:'预算',title:'尚无年度预算基准',reason:'查看年度预算与月份覆盖',url:'#bi-budget',level:'info'})
  if (summary.uses_demo_factors && summary.run_id) notices.push({tag:'因子',title:'快照含演示因子',reason:'查看快照因子和来源',url:'/audit/runs/'+encodeURIComponent(summary.run_id),level:'info'})
  return <section className="bi-panel bi-review"><header><h2>需核对事项</h2><span>{notices.length} 项</span></header>
    {!notices.length && <p className="bi-muted">{summary.run_id ? '本快照未触发预算、覆盖或因子提示。' : '完成首次核算后可检查预算及数据覆盖。'}</p>}
    {notices.map(n=>{const body=<><em data-level={n.level}>{n.tag}</em><div><b>{n.title}</b><small>{n.reason}</small></div><i aria-hidden="true">›</i></>
      return n.url.startsWith('#')?<a key={n.tag} href={n.url}>{body}</a>:<Link key={n.tag} to={n.url}>{body}</Link>})}
    {contributor && contributor.delta !== 0 && <div className="bi-insight">
      <span>本月变动最大来源</span>
      <p><b>{contributor.label}</b> 较上月{contributor.delta > 0 ? '增加' : '减少'} <strong>{tonnes(Math.abs(contributor.delta))}</strong> tCO₂e</p>
      <a href="#bi-drivers" onClick={onShowActivities}>分解到业务活动 <span aria-hidden="true">↓</span></a>
    </div>}
    {summary.run_id && <Link className="bi-sim-link" to={'/simulator?run='+encodeURIComponent(summary.run_id)}>用此快照试算减排方案 <span aria-hidden="true">→</span></Link>}
  </section>
}

type DriverMode = 'scope' | 'category'

export function ChangeDrivers({data,onScope,mode,setMode}:Props & {mode: DriverMode; setMode: (mode: DriverMode) => void}) {
  const previous=precedingMonth(data)
  const previousId=previous?.run_id
  const [prior,setPrior]=useState<DashboardRing|null>(null)
  const [failed,setFailed]=useState(false)
  const [attempt,retry]=useState(0)
  const companyId=data.company.id
  useEffect(()=>{
    if(!previousId || mode!=='category') return
    let active=true
    setPrior(null);setFailed(false)
    dashboardApi.getSnapshot(companyId,previousId).then(p=>{if(active)setPrior(p.ring)}).catch(()=>{if(active)setFailed(true)})
    return ()=>{active=false}
  },[companyId,previousId,mode,attempt])
  const scopeRows=scopes.map(scope=>({scope,category:'',name:scopeLabels[scope],now:data.summary.scope_breakdown[scope],then:previous?.[scope]??0,
    current:(data.drilldown.scopes[scope]?.items.length??0)>0}))
  const categories=new Map<string,{scope:string;category:string;name:string;now:number;then:number;current:boolean}>()
  for(const [items,current] of [[data.ring.categories,true],[prior?.categories??[],false]] as const){
    for(const row of items){
      const key=row.scope+'/'+row.category
      const item=categories.get(key)??{scope:row.scope,category:row.category,name:categoryLabel(row.category),now:0,then:0,current:false}
      if(current){item.now=row.emissions_kgco2e; item.current=true}else item.then=row.emissions_kgco2e
      categories.set(key,item)
    }
  }
  const rows=(mode==='scope'?scopeRows:Array.from(categories.values())).sort((a,b)=>Math.abs(b.now-b.then)-Math.abs(a.now-a.then))
  const limit=Math.max(...rows.map(r=>Math.abs(r.now-r.then)),1)
  return <section id="bi-drivers" className="bi-panel bi-drivers"><header><div><h2>环比变动来源</h2><small>{previous?`${previous.period} → ${data.summary.period} · 按变动绝对值排序`:'仅对相邻单月进行比较'}</small></div>
    <div className="bi-switch" aria-label="变动归因维度">{(['scope','category'] as const).map(m=><button key={m} type="button" aria-pressed={mode===m} onClick={()=>setMode(m)}>{m==='scope'?'按范围':'按活动'}</button>)}</div></header>
    {!previous?<p className="bi-muted">当前快照缺少可比上月。可从排放结构查看本期记录。</p>:mode==='category'&&!prior?
      <p className="bi-muted" role="status">{failed?<button onClick={()=>retry(n=>n+1)}>上月活动明细读取失败，重新加载</button>:'正在读取上月活动明细…'}</p>:
      <><div className="bi-dr-head"><span>排放来源</span><span>上月 → 本月（tCO₂e）</span><span>净变化（tCO₂e）</span></div>
        {rows.map(r=>{const delta=r.now-r.then
          const contents=<><b>{r.name}</b><small>{tonnes(r.then)} → {tonnes(r.now)}</small><span className="bi-delta" data-up={delta>0}><span className="bi-bar" aria-hidden="true"><i style={{width:`${Math.abs(delta)/limit*50}%`}}/></span>{signedTonnes(delta)} <span aria-hidden="true">›</span></span></>
          return r.current?<button key={r.scope+r.category} className="bi-driver" onClick={()=>onScope(r.scope,r.category||undefined)}>{contents}</button>:
          <Link key={r.scope+r.category} className="bi-driver" to={'/dashboard?'+new URLSearchParams({run:previousId!,view:'detail',scope:r.scope,...(r.category?{category:r.category}:{})})}>{contents}</Link>})}</>}
  </section>
}
