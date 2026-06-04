# Next.js 与 React 速成（Vue / Java 对照）

> 目标：用你已有的 Vue、Spring 经验，**快速映射**到本项目的 Next.js 14 + React 18 写法。

---

## 一、整体架构对照

| 概念 | Vue + Java 常见做法 | 本项目 (Next.js) |
|------|---------------------|------------------|
| 前端框架 | Vue 3 + Vue Router | React 18 + App Router（文件即路由） |
| 后端 | Spring Boot 独立进程 :8080 | Next.js API Routes，与前端 **同进程 :3000** |
| ORM | MyBatis / JPA | Prisma |
| 校验 | `@Valid` + Hibernate Validator | Zod（`*-validators.ts`） |
| 鉴权 | Spring Security Filter | `middleware.ts` + JWT Cookie |
| 部署 | 前后端分开 | 一个 Next 应用（可 Vercel） |

**关键差异：** 没有单独的 `axios baseURL` 指向 Java 后端；页面里直接 `fetch("/api/v1/orders")`，Next 在服务端执行 `route.ts`。

---

## 二、App Router：文件系统路由

### Vue Router 写法

```javascript
// router/index.js
{ path: '/orders', component: () => import('@/views/Orders.vue') }
```

### Next.js App Router 写法

```
src/app/orders/page.tsx     →  GET /orders  页面
src/app/login/page.tsx      →  GET /login
src/app/api/v1/orders/route.ts  →  GET/POST /api/v1/orders  API
```

| 文件 | URL | 作用 |
|------|-----|------|
| `app/layout.tsx` | 所有页面外层 | 类似 `App.vue` 的 `<router-view>` 外壳 |
| `app/page.tsx` | `/` | 首页 |
| `app/orders/page.tsx` | `/orders` | 订单页 |
| `app/api/v1/orders/route.ts` | `/api/v1/orders` | REST API |

**动态路由：**

```
app/api/v1/orders/[id]/route.ts     →  /api/v1/orders/123
app/google-sheet/[containerNo]/page.tsx  →  /google-sheet/EGSU6027772
```

在 API 里取参数：

```typescript
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const orderId = Number(params.id);
}
```

类比 Spring：`@PathVariable("id") Long id`。

---

## 三、Server Component vs Client Component

Next.js 14 默认：**所有组件都是 Server Component**（在 Node 服务端渲染 HTML）。

需要浏览器能力（`useState`、`useEffect`、`onClick`、`localStorage`）时，文件顶部加：

```typescript
"use client";
```

### 对照

| | Vue SFC | Next.js |
|---|---------|---------|
| 默认运行位置 | 浏览器 | 服务端（无 `"use client"`） |
| 交互 / 状态 | 直接写 | 必须 `"use client"` |
| 数据请求 | `onMounted` + axios | Server 组件可 `async` 直接查库；Client 组件用 `fetch` |

### 本项目惯例

| 类型 | 示例 | 说明 |
|------|------|------|
| Server | `app/layout.tsx` | 静态外壳，无交互 |
| Client | `app/orders/page.tsx` | 整页表格交互，顶部 `"use client"` |
| Client | `LoginForm.tsx` | 表单、toast |
| Server | `app/api/v1/**/route.ts` | 纯服务端，永远不是 Client |

**为什么订单页整页是 Client？**  
表格编辑、排序、列拖拽、localStorage 列偏好都需要浏览器 API；本项目选择「页面级 Client + fetch API」，而不是 Server 组件 SSR 数据。

---

## 四、React 语法对照 Vue（5 分钟上手）

### 4.1 组件与模板

**Vue：**
```vue
<template>
  <button @click="count++">{{ count }}</button>
</template>
<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>
```

**React（本项目风格）：**
```tsx
"use client";
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>{count}</button>
  );
}
```

| Vue | React |
|-----|-------|
| `ref(0)` | `useState(0)` → `[count, setCount]` |
| `computed(() => ...)` | `useMemo(() => ..., [deps])` |
| `watch(source, fn)` | `useEffect(() => fn, [deps])` |
| `@click` | `onClick` |
| `:class="{ active: x }"` | `className={x ? "active" : ""}` |
| `v-if` | `{condition && <div/>}` |
| `v-for="item in list"` | `{list.map(item => <div key={item.id}/>)}` |

### 4.2 生命周期

| Vue | React |
|-----|-------|
| `onMounted` | `useEffect(() => { ... }, [])` |
| `onUnmounted` | `useEffect(() => { return () => cleanup }, [])` |
| `watch(() => route.params.id)` | `useEffect(() => { ... }, [id])` |

本项目订单页加载数据：

```typescript
useEffect(() => {
  void loadOrders();
  void loadUser();
}, [loadOrders]);
```

### 4.3 路由跳转

| Vue Router | Next.js |
|------------|---------|
| `router.push('/orders')` | `const router = useRouter(); router.push('/orders')` |
| `route.query.redirect` | `useSearchParams().get('redirect')` |

见 `LoginForm.tsx`：

```typescript
const router = useRouter();
const searchParams = useSearchParams();
router.push(searchParams.get("redirect") || "/google-sheet");
router.refresh();  // 让 Server 侧缓存失效，类似重新拉 layout
```

---

## 五、API Route = Spring Controller

### Spring

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
  @GetMapping
  public ResponseEntity<?> list(@RequestParam int page) { ... }

  @PostMapping
  public ResponseEntity<?> create(@RequestBody OrderDto dto) { ... }
}
```

### Next.js Route Handler

文件：`src/app/api/v1/orders/route.ts`

```typescript
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);
  // prisma.orders.findMany(...)
  return success(serialize(rows), pagination);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = orderCreateSchema.safeParse(body);
  if (!parsed.success) return error("Validation failed", 400, ...);
  const created = await prisma.orders.create({ data: buildOrderCreateInput(...) });
  return success(serialize(created));
}
```

**约定：**
- 导出名必须是 HTTP 方法：`GET` / `POST` / `PUT` / `DELETE`
- 返回 `NextResponse.json(...)`，本项目封装为 `success()` / `error()`

---

## 六、Middleware = Filter / 路由守卫

文件：`src/middleware.ts`

| Spring Security | Next middleware |
|-----------------|-----------------|
| `OncePerRequestFilter` | `export function middleware(request)` |
| 白名单 `/login` | `publicPaths` 数组 |
| 无 Token → 401 | API 返回 JSON 401 |
| 无 Token → 重定向 | 页面 `NextResponse.redirect('/login')` |

**Edge Runtime 限制：** 不能 `import { prisma }`，不能 Node fs。只做 Cookie 存在性检查；细粒度权限在 API 里 `requireUser` + `canWrite`。

---

## 七、目录别名 `@/`

`tsconfig.json`：

```json
"paths": { "@/*": ["./src/*"] }
```

`@/lib/auth` = `src/lib/auth`，类似 Java 里统一包名前缀。

---

## 八、样式：Tailwind CSS

本项目 **不用** Vue 的 `<style scoped>`，改用 **utility class**：

```tsx
<button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
  保存
</button>
```

常用：`flex`、`grid`、`min-h-screen`、`text-sm`、`border-slate-200`。  
在浏览器 DevTools 里对着订单页看 class 即可快速熟悉。

---

## 九、本项目前端数据流范式

几乎所有业务页重复同一模式：

```
1. useEffect 加载列表 → GET /api/v1/xxx?page=1&pageSize=20
2. useState 存 rows、loading、pagination、sort
3. 双击行 → 行内编辑 → PUT /api/v1/xxx/[id]
4. 底部新行 → POST /api/v1/xxx
5. 勾选删除 → DELETE /api/v1/xxx/batch
6. toast.success / toast.error（sonner）
7. 列宽/顺序/可见性 → custom hook + localStorage
```

**没有 Pinia / Vuex**：状态都在页面组件 `useState` 里；用户信息每次 `GET /api/v1/auth/me`。

---

## 十、构建与运行

| 命令 | 类比 Java |
|------|-----------|
| `npm run dev` | `spring-boot:run`，热更新 |
| `npm run build` | `mvn package`，生产构建 |
| `npm run start` | `java -jar`，跑 build 产物 |
| `npx prisma generate` | 根据 schema 生成 Client（类似 MyBatis generator） |

---

## 十一、和 Vue 比，你最该记住的 5 点

1. **路由靠文件夹**，不是 `router.js` 配置表。  
2. **默认 Server Component**；有交互就加 `"use client"`。  
3. **API 和页面在同一个 repo**，`fetch('/api/...')` 相对路径即可。  
4. **没有 `.vue` 单文件**，JSX 即模板；一个文件里 export default function 就是组件。  
5. **Hooks 规则**：只在函数组件顶层调用 `useState` / `useEffect`，不能放在 if 里。

---

## 十二、延伸阅读（官方）

- [Next.js App Router 文档](https://nextjs.org/docs/app)  
- [React useState / useEffect](https://react.dev/reference/react)  

读完本文后，打开 [04-请求链路详解](./04-请求链路详解(从点击到数据库).md) 看三条真实链路。
