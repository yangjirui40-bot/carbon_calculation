import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { DashboardTrend } from '../../../api/types'
import BaseChart from '../../../components/charts/BaseChart'
import SwissEmpty from '../../../components/swiss/SwissEmpty'
import SwissSection from '../../../components/swiss/SwissSection'
import { formatEmission, formatNumber } from '../../../utils/format'
import { getSwissChartPalette } from '../../../utils/chartTheme'

export default function TrendSection({ trend }: { trend: DashboardTrend }) {
  const navigate = useNavigate()
  const option = useMemo<EChartsOption>(() => {
    const color = getSwissChartPalette()
    const history = trend.historical
    const forecast = trend.forecast
    const actual = new Map(history.map(p => [p.period,p]))
    const projected = new Map(forecast.map(p => [p.period,p.total]))
    const observed = [...actual.keys(), ...projected.keys()].sort()
    const months:string[] = []
    // Insert empty months so the line also shows gaps in reporting.
    for (const period of observed) {
      const last=months.at(-1)
      if(last) {
        const [y,m]=last.split('-').map(Number), [ey,em]=period.split('-').map(Number)
        const gap=(ey-y)*12+em-m
        if(gap>36) months.push('…')
        else for(let i=1;i<gap;i++)months.push(new Date(Date.UTC(y,m-1+i,1)).toISOString().slice(0,7))
      }
      months.push(period)
    }
    const monthly=trend.monthly_budget_kgco2e
    const last=history.at(-1)
    return {
      color:[color.s2, color.accent, color.fail],
      tooltip:{trigger:'axis',renderMode:'richText',valueFormatter:value=>typeof value==='number'?formatNumber(value)+' tCO₂e':'暂无'},
      legend:{top:2,right:2,textStyle:{color:color.muted,fontSize:11},itemWidth:20,itemHeight:6},
      grid:{left:12,right:16,top:46,bottom:10,containLabel:true},
      xAxis:{type:'category',data:months,boundaryGap:false,axisTick:{show:false},axisLabel:{color:color.muted,hideOverlap:true,formatter:(s:string)=>s==='…' ? s : s.slice(2).replace('-','/')} },
      yAxis:{type:'value',min:0,splitNumber:4,axisLabel:{color:color.muted},splitLine:{lineStyle:{color:color.ruleSoft,type:'dashed'}}},
      series:[
        {type:'line',name:'月度实绩',symbol:'circle',symbolSize:6,lineStyle:{width:3},areaStyle:{opacity:0.08},
         data:months.map(period=>{const p=actual.get(period);return p?{value:p.total/1000,run:p.run_id}:null})},
        ...(forecast.length?[{type:'line' as const,name:'线性预测',symbol:'diamond',symbolSize:6,lineStyle:{type:'dashed' as const},
          data:months.map(period=>{const v=projected.get(period);return v!=null?{value:v/1000,itemStyle:{color:monthly!=null && period.startsWith(trend.budget_year+'-') && v>monthly?color.fail:color.accent}}:period===last?.period?last.total/1000:null})}]:[]),
        ...(monthly==null?[]:[{type:'line' as const,name:'月度预算',symbol:'none',lineStyle:{type:'dotted' as const,width:2},
          data:months.map(period=>period.startsWith(trend.budget_year+'-')?monthly/1000:null)}])
      ]
    }
  }, [trend])
  return (
    <SwissSection title="月度核算趋势" extra="tCO₂e">
      {trend.historical.length ? (
        <>
          <BaseChart option={option} ariaLabel="成功月度核算及线性估算，具体数据见下方明细" height={232} onItemClick={item=>{
            if(item && typeof item==='object' && 'run' in item && typeof item.run==='string')navigate('/dashboard?run='+encodeURIComponent(item.run))
          }} />
          <p className="dash-card__note">{trend.forecast.length ? '点实绩月份可切换快照。虚线按近月数据线性外推。' : '至少有连续三个月的单月核算快照时才生成趋势估算。'}</p>
          {trend.exceed_warning && <p className="dash-quality" role="status">
            部分预测月份超过月度预算，红色点标出对应月份。
          </p>}
          <details className="dash-data">
            <summary>查看月度数据</summary>
            <table className="dash-mini">
              <thead><tr><th>月份</th><th>口径</th><th>排放 kgCO₂e</th></tr></thead>
              <tbody>
                {trend.historical.map((point) => <tr key={point.period}><td>{point.run_id ? <Link to={`/dashboard?run=${point.run_id}`}>{point.period}</Link> : point.period}</td><td>核算快照</td><td>{formatEmission(point.total)}</td></tr>)}
                {trend.forecast.map((point) => <tr key={point.period}><td>{point.period}</td><td>估算</td><td>{formatEmission(point.total)}</td></tr>)}
              </tbody>
            </table>
          </details>
        </>
      ) : <SwissEmpty title="尚无月度核算" description="按 YYYY-MM 单月完成核算后，趋势区会使用相应月份的成功快照。" />}
    </SwissSection>
  )
}
