import type { Generated } from "kysely";
export interface IdentitySettingsTables {
  identity_settings: {
    tenant_id: string;
    display_name: string;
    locale: string;
    time_zone: string;
    version: Generated<number>;
  };
  identity_app_settings: {
    app_id: string;
    display_name: string;
    locale: string;
    time_zone: string;
    session_seconds: number;
    version: Generated<number>;
  };
}
export type IdentitySettingsRow = IdentitySettingsTables["identity_settings"];
export type IdentityAppSettingsRow = IdentitySettingsTables["identity_app_settings"];
