export enum NotificationChannelType {
  Global = 0,
  Menu = 1,
  Match = 2,
}

export enum NotificationChannelName {
  Global = "GLOBAL",
  Menu = "MENU",
  Match = "MATCH",
}

export const NotificationChannelNameToType: Record<
  NotificationChannelName,
  NotificationChannelType
> = {
  [NotificationChannelName.Global]: NotificationChannelType.Global,
  [NotificationChannelName.Menu]: NotificationChannelType.Menu,
  [NotificationChannelName.Match]: NotificationChannelType.Match,
};
