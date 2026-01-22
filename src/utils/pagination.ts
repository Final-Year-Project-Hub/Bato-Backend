
export type PaginationOptions = {
  page?: string | number;
  limit?: string | number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

const defaultLimit = 10;
const maxLimit = 100;

export function paginate(options: PaginationOptions) {
  const page = Math.max(parseInt(String(options.page ?? "1"), 10) || 1, 1);
  const limit = Math.min(
    Math.max(
      parseInt(String(options.limit ?? defaultLimit), 10) || defaultLimit,
      1
    ),
    maxLimit
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    search: options.search,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  };
}
