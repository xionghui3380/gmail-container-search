# 技术栈速查（TypeScript · Prisma · Zod · 其他）

> 面向 Java 后端 + Vue 前端背景，只讲 **本项目里实际出现** 的用法。

---

## 一、TypeScript 速览

### 1.1 与 Java 的类型差异

| Java | TypeScript（本项目） |
|------|----------------------|
| `Long id` | `id: string` 或 `bigint`（API 层常转 string） |
| `List<Order>` | `OrderRow[]` |
| `Optional<String>` | `string \| null \| undefined`，常用 `string?` 在 type 里 |
| `@Nullable` | `field?: string` 可选属性 |
| 接口 DTO | `type OrderRow = { id: string; container_no: string; ... }` |

### 1.2 常见写法

```typescript
// 类型别名（类似 Java record / DTO）
type OrderRow = {
  id: string;
  container_no: string;
  customer?: string | null;
};

// 函数参数与返回
async function loadOrders(page: number): Promise<OrderRow[]> { ... }

// 泛型（api-response）
function success<T>(data: T) { ... }

// 类型导入（仅编译期，不会打进 bundle）
import type { AuthUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
```

### 1.3 `async/await`

与 Java 几乎相同。API route 和 Service 层大量：

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const user = await prisma.users.findFirst({ where: { email } });
}
```

### 1.4 解构与展开

```typescript
const { email, password } = parsed.data;
return NextResponse.json({ ...user, role: user.role });
```

---

## 二、Prisma ORM

### 2.1 角色对照

| Java | Prisma |
|------|--------|
| `@Entity` + `@Table` | `model orders { ... @@map("orders") }` |
| `@Id @GeneratedValue` | `@id @default(autoincrement())` |
| `@ManyToOne` | `orders orders @relation(...)` |
| Repository 接口 | 直接 `prisma.orders.findMany()` |
| `@Query` 手写 SQL | `prisma.$queryRaw`（本项目少用） |

Schema 文件：`prisma/schema.prisma`  
客户端单例：`src/lib/prisma.ts`

### 2.2 常用 API

```typescript
// 查一条
await prisma.orders.findFirst({ where: { id: orderId } });

// 列表 + 分页 + 条件
await prisma.orders.findMany({
  where: { container_no: { contains: keyword, mode: "insensitive" } },
  orderBy: { created_at: "desc" },
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// 计数
await prisma.orders.count({ where });

// 创建
await prisma.orders.create({ data: { container_no: "...", created_by: userId } });

// 更新
await prisma.orders.update({ where: { id }, data: { customer: "..." } });

// 删除
await prisma.orders.delete({ where: { id } });

// 事务
await prisma.$transaction(async (tx) => {
  await tx.containers.create({ ... });
  await tx.parse_logs.create({ ... });
});
```

### 2.3 BigInt 问题

PostgreSQL `BIGINT` 在 JS 里是 `bigint`，`JSON.stringify` 会报错。

**解决：** 所有 API 返回前走 `serialize()`（`src/lib/serialize.ts`），把 `bigint` 转成 `string`。

### 2.4 改表流程（本项目）

1. 改 `prisma/schema.prisma`  
2. 写或更新 `prisma/sql/*.sql`  
3. `npm run db:ensure-parse`（或对应脚本）  
4. `npx prisma generate`  
5. 代码里使用新型别  

---

## 三、Zod 校验

### 3.1 对照 Bean Validation

| Java | Zod |
|------|-----|
| `@NotBlank String email` | `z.string().min(1)` |
| `@Email` | `z.string().email()` |
| `@Pattern` | `z.string().regex(...)` |
| `@Valid` + BindingResult | `schema.safeParse(body)` |

### 3.2 本项目模式

文件：`src/lib/order-validators.ts`

```typescript
import { z } from "zod";

export const orderCreateSchema = z.object({
  container_no: z.string().min(1, "柜号不能为空"),
  customer: z.string().optional().nullable(),
  order_date: z.string().optional().nullable(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
```

API 中使用：

```typescript
const parsed = orderCreateSchema.safeParse(body);
if (!parsed.success) {
  return error("Validation failed", 400, parsed.error.issues.map(issue => ({
    field: issue.path.join("."),
    message: issue.message,
  })));
}
// parsed.data 类型安全
```

### 3.3 Mapper 层

Zod 校验通过后，**mapper** 把 DTO 转成 Prisma 的 `CreateInput`：

```typescript
// order-mapper.ts
export function buildOrderCreateInput(data: OrderCreateInput, userId: bigint) {
  return {
    container_no: data.container_no.trim(),
    customer: data.customer ?? null,
    created_by: userId,
    updated_by: userId,
  };
}
```

**三板斧：** `*-validators.ts` + `*-mapper.ts` + `*-list-query.ts`

---

## 四、统一 API 响应

文件：`src/lib/api-response.ts`

```typescript
// 成功
return success(data);
return success(list, { page, pageSize, total, totalPages });

// 失败
return error("未登录", 401);
return error("Validation failed", 400, [{ field: "email", message: "..." }]);
```

前端统一判断：

```typescript
const res = await fetch("/api/v1/orders");
const json = await res.json();
if (!res.ok) {
  toast.error(json.message ?? "请求失败");
  return;
}
const rows = json.data;
```

---

## 五、JWT 与 Cookie（jose 库）

文件：`src/lib/auth.ts`

| 环境变量 | 默认 | 说明 |
|----------|------|------|
| `JWT_SECRET` | 必填 ≥32 字符 | 签名密钥 |
| `JWT_ACCESS_EXPIRES` | `15m` | Access Token |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh Token |

Cookie 名：
- `gng_access_token`
- `gng_refresh_token`

角色权限：

```typescript
canWrite(role)   // admin | operator
canDelete(role)  // admin | operator
```

---

## 六、Gmail 相关环境变量

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/gmail/callback
GMAIL_DEFAULT_SENDER=wenyang@ggtransport.in
```

Token 存 Cookie（`gmail-tokens.ts`），与登录 JWT 分离。

---

## 七、Excel / CSV 解析

| 库 | 用途 |
|----|------|
| `exceljs` | 读 `.xlsx` |
| 手工解析 | `.csv` → 二维数组 |

入口：`parseDeliveryFileBuffer(buffer, filename, containerNo)`  
列映射：`FIELD_ALIASES`（中英文表头 → 标准字段）

---

## 八、UI 与工具库

| 库 | 用途 |
|----|------|
| `tailwindcss` | 样式 |
| `lucide-react` | 图标（类似 iconify） |
| `sonner` | Toast 通知 |
| `date-fns` | 日期格式化 |
| `@dnd-kit/*` | Google Sheet 列拖拽排序 |
| `bcryptjs` | 密码 hash |
| `googleapis` | Gmail API |

---

## 九、ESLint 与路径

- ESLint：`eslint-config-next`  
- 绝对导入：`@/lib/...`、`@/components/...`  

---

## 十、复制新模块 checklist

假设新增「客户管理 `/customers`」：

1. `prisma/schema.prisma` 加 `customers` model + SQL  
2. `src/lib/customer-validators.ts`  
3. `src/lib/customer-mapper.ts`  
4. `src/lib/customer-list-query.ts`  
5. `src/lib/customer-columns.ts`  
6. `src/app/api/v1/customers/route.ts` + `[id]/route.ts`  
7. `src/app/customers/page.tsx`（复制 orders 页改字段）  
8. `Sidebar.tsx` 加菜单  
9. `middleware.ts` 通常 **不用改**（已保护非公开路径）  

---

下一步：[04-请求链路详解](./04-请求链路详解(从点击到数据库).md)
