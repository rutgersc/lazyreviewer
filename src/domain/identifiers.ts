import { Brand } from "effect";

export type MrGid = string & Brand.Brand<"MrGid">
export type MrIid = string & Brand.Brand<"MrIid">

export const MrGid = Brand.nominal<MrGid>()
export const MrIid = Brand.nominal<MrIid>()
