import {prisma} from "@/lib/prisma";
import {canDelete} from "@/lib/auth";
import {error, success} from "@/lib/api-response";
import {customerListBaseWhere} from "@/lib/customer-list-query";
import {requireUser} from "@/lib/require-user";
import {customerBatchDeleteSchema} from "@/lib/customer-validators";

export async function DELETE(request: Request) {
    const user = await requireUser(request as import("next/server").NextRequest);
    if (!user) return error("Unauthorized", 401);
    if (!canDelete(user.role)) return error("权限不足", 403);

    try {
        const body = await request.json();
        const parsed = customerBatchDeleteSchema.safeParse(body);
        if (!parsed.success) return error("Validation failed", 400);

        const ids = parsed.data.ids
            .map((id) => {
                try {
                    return BigInt(id);
                } catch {
                    return null;
                }
            })
            .filter((id): id is bigint => id !== null);

        const result = await prisma.customers.updateMany({
            where: {id: {in: ids}, ...customerListBaseWhere},
            data: {deleted_at: new Date()},
        });

        return success({deleted: result.count});
    } catch (err) {
        console.error("[customers batch DELETE]", err);
        return error("批量删除失败", 500);
    }
}