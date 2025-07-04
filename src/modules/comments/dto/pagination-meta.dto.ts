import { Expose, Transform } from 'class-transformer';

// this is the metadata for the pagination
export class PaginationMetaDto {
  @Expose()
  @Transform(({ value }) => Number(value))
  currentPage: number;

  @Expose()
  @Transform(({ value }) => Number(value))
  itemsPerPage: number;

  @Expose()
  @Transform(({ value }) => Number(value))
  totalItems: number;

  @Expose()
  @Transform(({ value }) => Number(value))
  totalPages: number;

  @Expose()
  hasNextPage: boolean;

  @Expose()
  hasPreviousPage: boolean;
}