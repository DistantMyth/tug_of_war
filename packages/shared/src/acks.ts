import type { ErrorCode } from "./errors.js";

export type OkAck<T> = {
  ok: true;
  data: T;
};

export type ErrAck = {
  ok: false;
  code: ErrorCode;
  message: string;
};

export type Ack<T = unknown> = OkAck<T> | ErrAck;
