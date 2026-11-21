import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import type { ROIResponse } from '../../../api/types'
import { formatAmount,formatNumber,formatPercent } from '../../../utils/format'
import BaseChart from '../../../components/charts/BaseChart'

export default function InvestmentOutcome({roi}: {roi:ROIResponse}) {
  const balances=useMemo(() => [
    {year:0, nominal:-roi.capex, discounted:-roi.capex},
    ...roi.cash_flows.map(row => ({
      year:row.year, nominal:row.cumulative-roi.capex, discounted:row.discounted_cumulative-roi.capex,
    })),
  ], [roi])
  const option=useMemo<EChartsOption>(()=>({
    color:['#15796f','#5273a5'],tooltip:{trigger:'axis',renderMode:'richText',valueFormatter:v=>typeof v==='number'?formatNumber(v)+' 万元':'暂无'},
    legend:{top:0,right:0,itemWidth:18,itemHeight:6,textStyle:{fontSize:11}},grid:{top:35,bottom:12,left:8,right:20,containLabel:true},
    xAxis:{type:'category',data:balances.map(r=>r.year===0 ? '初始' : `第${r.year}年`),axisLabel:{hideOverlap:true}},yAxis:{type:'value',splitNumber:3,splitLine:{lineStyle:{type:'dashed',color:'#dce6e7'}}},
    series:[{type:'line',name:'累计现金流',data:balances.map(r=>r.nominal/10000),symbolSize:5,
      markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:'#64767d',type:'dotted'},data:[{yAxis:0}]}},
      {type:'line',name:'折现累计现金流',symbol:'none',lineStyle:{type:'dashed'},data:balances.map(r=>r.discounted/10000)}]
  }),[balances])
  const payback=roi.payback_period_years
  const conclusion=roi.capex===0?'无初始投入':payback==null || payback>roi.project_life?'周期内未回收':'周期内可回收'
  return <div className="investment-result">
    <div className="invest-summary"><div><span>静态回收期</span><strong>{payback==null?'暂无':formatNumber(payback,1)+' 年'}</strong>
      <small>{roi.project_life} 年项目周期 · {conclusion}</small></div>
      <div><span>折现净现值</span><strong>{formatAmount(roi.npv)}</strong><small>折现率 {formatPercent(roi.discount_rate)}</small></div>
      <div><span>经营净流入 / 初始投资</span><strong>{formatPercent(roi.roi)}</strong><small>年净现金流 {formatAmount(roi.annual_net_cash_flow)}</small></div></div>
    {roi.cash_flows.length>0&&<><h3>投资何时回正 <small>万元</small></h3>
      <BaseChart option={option} height={174} ariaLabel="各年累计和折现现金流与零线的比较"/>
      <details><summary>逐年核对现金流</summary><div className="invest-table"><table><thead><tr><th>年份</th><th>累计现金流（元）</th><th>折现累计余额（元）</th></tr></thead><tbody>
        {balances.map(r=><tr key={r.year}><td>{r.year}</td><td>{formatNumber(r.nominal)}</td><td>{formatNumber(r.discounted)}</td></tr>)}</tbody></table></div></details></>}
  </div>
}
