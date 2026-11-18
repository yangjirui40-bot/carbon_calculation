import SwissEmpty from '../components/swiss/SwissEmpty'
import SwissMasthead from '../components/swiss/SwissMasthead'
import SwissSection from '../components/swiss/SwissSection'
import './RouteStub.css'

type RouteStubProps = {
  /** 所属导航分组，例如“核算” */
  kicker: string
  /** 页面名称 */
  title: string
  /** 页面目标，一句话 */
  description?: string
}

/**
 * 路由占位页：路由、权限与壳层已就绪，业务内容由后续批次替换。
 * 只使用 T2 的瑞士风格共享组件，不写页面业务。
 */
export default function RouteStub({ kicker, title, description }: RouteStubProps) {
  return (
    <div className="route-stub">
      <SwissMasthead kicker={kicker} title={title} description={description} />
      <SwissSection title="页面状态">
        <SwissEmpty
          title="页面待实现，路由与权限已就绪"
          description={
            description ?? '本页面的路由、角色权限与壳层已接入，内容将在后续批次实现。'
          }
        />
      </SwissSection>
    </div>
  )
}
