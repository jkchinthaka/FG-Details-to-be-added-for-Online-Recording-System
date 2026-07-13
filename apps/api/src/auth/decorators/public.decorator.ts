import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route (or entire controller) as exempt from JwtAuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
