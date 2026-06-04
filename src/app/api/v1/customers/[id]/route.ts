import {prisma} from "@/lib/prisma";
import {canDelete, canWrite} from "@/lib/auth";
import {error, success} from "@/lib/api-response";
import {buildCustomerUpdateInput} from "@/lib/customer-mapper";
import {customerListBaseWhere} from "@/lib/customer-list-query";
import {requireUser} from "@/lib/require-user";
import {serialize} from "@/lib/serialize";
import {customerUpdateSchema} from "@/lib/customer-validators";

type Params = { params: { id: string } };

export async function GET(request: Request, {params}: Params) {
    const user = await requireUser(request as import("next/server").NextRequest);
    if (!user) return error("Unauthorized", 401);

    let id: bigint;
    try {
        id = BigInt(params.id);
    } catch {
        return error("无效 ID", 400);
    }

    const item = await prisma.customers.findFirst({
        where: {id, ...customerListBaseWhere},
    });
    if (!item) return error("记录不存在", 404);
    return success(serialize(item));
}

export async function PUT(request: Request, {params}: Params) {
    const user = await requireUser(request as import("next/server").NextRequest);
    if (!user) return error("Unauthorized", 401);
    if (!canWrite(user.role)) return error("权限不足", 403);

    let id: bigint;
    try {
        id = BigInt(params.id);
    } catch {
        return error("无效 ID", 400);
    }

    try {
        const body = await request.json();
        const parsed = customerUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return error(
                "Validation failed",
                400,
                parsed.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            );
        }

        const existing = await prisma.customers.findFirst({
            where: {id, ...customerListBaseWhere},
        });
        if (!existing) return error("记录不存在", 404);

        const updated = await prisma.customers.update({
            where: {id},
            data: buildCustomerUpdateInput(parsed.data, BigInt(user.id)),
        });
        return success(serialize(updated));
    } catch (err) {
        console.error("[customers PUT]", err);
        return error("更新失败", 500);
    }
}

export async function DELETE(request: Request, {params}: Params) {
    const user = await requireUser(request as import("next/server").NextRequest);
    if (!user) return error("Unauthorized", 401);
    if (!canDelete(user.role)) return error("权限不足", 403);

    let id: bigint;
    try {
        id = BigInt(params.id);
    } catch {
        return error("无效 ID", 400);
    }

    const existing = await prisma.customers.findFirst({
        where: {id, ...customerListBaseWhere},
    });
    if (!existing) return error("记录不存在", 404);

    await prisma.customers.update({
        where: {id},
        data: {deleted_at: new Date()},
    });
    return success({id: params.id});
}