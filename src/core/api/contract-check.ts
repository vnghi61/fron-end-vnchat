// Kiểm tra lúc typecheck (không chạy runtime): mọi field khai trong types.ts phải tồn tại trong schema OpenAPI sinh ra.
// Thêm field không có trong OpenAPI → `npm run typecheck` báo lỗi → cập nhật backend/OpenAPI trước, rồi `npm run gen:api`.
import type { components } from "./generated/openapi";
import type * as T from "./types";

type S = components["schemas"];
type Item<A> = A extends readonly (infer U)[] ? U : never;
type Defined<X> = Exclude<X, null | undefined>;

/** `true` khi mọi khoá của Domain đều có trong Spec; ngược lại ra tên khoá thừa để lỗi dễ đọc. */
type KeysIn<Domain, Spec> =
  Exclude<keyof Domain, keyof Defined<Spec>> extends never
    ? true
    : { extraKeys: Exclude<keyof Domain, keyof Defined<Spec>> };

type Assert<X extends true> = X;

export type ContractChecks = [
  Assert<KeysIn<T.UserBrief, S["UserBrief"]>>,
  Assert<KeysIn<T.UserProfile, S["UserProfile"]>>,
  Assert<KeysIn<T.Session, S["Session"]>>,
  Assert<KeysIn<T.Attachment, S["Attachment"]>>,
  Assert<KeysIn<T.Message, S["Message"]>>,
  Assert<KeysIn<T.Reaction, Item<Defined<S["Message"]["reactions"]>>>>,
  Assert<KeysIn<T.ReplyPreview, S["Message"]["replyPreview"]>>,
  Assert<KeysIn<T.SendMessageBody, S["SendMessage"]>>,
  Assert<KeysIn<T.Conversation, S["Conversation"]>>,
  Assert<KeysIn<T.ConversationMember, Item<Defined<S["Conversation"]["members"]>>>>,
  Assert<KeysIn<T.LastMessage, S["Conversation"]["lastMessage"]>>,
  Assert<KeysIn<T.SupportInfo, S["Conversation"]["support"]>>,
  Assert<KeysIn<T.Poll, S["Poll"]>>,
  Assert<KeysIn<T.PollOption, Item<Defined<S["Poll"]["options"]>>>>,
  Assert<KeysIn<T.Reminder, S["Reminder"]>>,
  Assert<KeysIn<T.Page<unknown>, S["Page"] & { items: unknown }>>,
];
