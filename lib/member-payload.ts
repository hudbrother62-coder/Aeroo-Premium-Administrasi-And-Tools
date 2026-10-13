/** Strip legacy position metadata before invoking save_member. */
export type MemberPlacementInput = {
  id?: string;
  category_id: string;
  class_id?: string | null;
  level_id?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  active?: boolean;
  [key: string]: unknown;
};
export function normalizeMemberships(rows: MemberPlacementInput[]) {
  return rows.map(m => ({
    ...(m.id ? {id:m.id} : {}),
    category_id:m.category_id,
    class_id:m.class_id || null,
    level_id:m.level_id || null,
    valid_from:m.valid_from || null,
    valid_to:m.valid_to || null,
    active:m.active !== false
  }));
}
