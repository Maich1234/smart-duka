/**
 * The Purchasing module is mounted under both (owner) and (staff) route
 * groups with an identical screen set (see app/(owner)/purchases/ and
 * app/(staff)/purchases/) — every Purchasing screen/component derives its
 * navigation targets from the current user's role via this helper instead
 * of hardcoding one group.
 */
export const purchasingBasePath = (role?: string) => (role === 'owner' ? '/(owner)/purchases' : '/(staff)/purchases');
