import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const ProductsPage = lazy(() => import('../../pages/products/ProductsPage'))
const ProductDetailPage = lazy(() => import('../../pages/products/ProductDetailPage'))

/** 产品碳足迹：产品列表、产品详情与 BOM */
export const productRoutes: RouteObject[] = [
  { path: 'products', element: <ProductsPage /> },
  { path: 'products/:productId', element: <ProductDetailPage /> },
]
