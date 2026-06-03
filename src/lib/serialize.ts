/**
 * 数据序列化工具
 *
 * 解决 Prisma 查询结果中 BigInt 类型无法被 JSON.stringify 序列化的问题。
 * PostgreSQL 的 BIGINT 主键在 Prisma 中映射为 JavaScript BigInt，
 * 而 JSON.stringify 不支持 BigInt 类型，直接序列化会抛出 TypeError。
 *
 * 原理：通过 JSON.stringify 的 replacer 函数，将所有 BigInt 值转为字符串。
 * 所有 API 路由在返回数据前都必须调用 serialize() 进行转换。
 *
 * 使用方式：
 *   const data = await prisma.containers.findMany({...});
 *   return success(serialize(data));  // BigInt id 变成 "123" 字符串
 */
export function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as T;
}
