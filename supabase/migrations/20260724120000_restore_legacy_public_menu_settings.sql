-- Restore legacy public menu settings after menus.settings_json was introduced.
--
-- This migration only fills an empty settings_json on a primary menu from one
-- meaningful publicMenuSettings object belonging to the same restaurant.
-- Published configuration wins; otherwise the newest draft is used strictly as
-- a historical backfill source. Draft rows are never published or modified.
--
-- Rollback: use the pre-migration dry-run output to restore only the affected
-- menu ids to their previous settings_json values. Do not blanket-reset rows,
-- because an owner may have saved new settings after this migration ran.

with ranked_legacy_settings as (
  select
    menu.id as menu_id,
    menu.restaurant_id,
    jsonb_strip_nulls(ui.config_json -> 'publicMenuSettings') as settings,
    row_number() over (
      partition by menu.restaurant_id
      order by
        case ui.status when 'published' then 0 else 1 end,
        ui.updated_at desc nulls last,
        ui.id desc
    ) as source_rank
  from public.menus as menu
  join public.menu_ui_configs as ui
    on ui.restaurant_id = menu.restaurant_id
  where menu.is_primary is true
    and coalesce(menu.settings_json, '{}'::jsonb) = '{}'::jsonb
    and not exists (
      select 1
      from public.menu_ui_configs as unique_ui
      where unique_ui.restaurant_id = menu.restaurant_id
        and (
          jsonb_typeof(unique_ui.config_json -> 'uniqueDesign') = 'object'
          or coalesce(
            unique_ui.config_json -> 'publicMenuSettings' ->> 'publicMenuStyle',
            unique_ui.config_json ->> 'publicMenuStyle',
            ''
          ) = 'unique'
        )
    )
    and ui.status in ('published', 'draft')
    and jsonb_typeof(ui.config_json -> 'publicMenuSettings') = 'object'
    and (ui.config_json -> 'publicMenuSettings') ?| array[
      'defaultLocale',
      'default_locale',
      'locale',
      'supportedLocales',
      'supported_locales',
      'locales',
      'baseCurrency',
      'base_currency',
      'currency',
      'defaultCurrency',
      'default_currency',
      'supportedCurrencies',
      'supported_currencies',
      'currencies',
      'publicMenuStyle',
      'public_menu_style',
      'menuStyle',
      'menu_style',
      'menuExperience',
      'menu_experience',
      'timezone',
      'timeZone',
      'defaultThemeMode',
      'default_theme_mode',
      'themeMode',
      'allowThemeToggle',
      'allow_theme_toggle',
      'allowCurrencySelector',
      'allow_currency_selector',
      'allowLanguageSelector',
      'allow_language_selector',
      'taxIncluded',
      'tax_included',
      'priceDisplayMode',
      'price_display_mode'
    ]
)
update public.menus as menu
set settings_json = source.settings
from ranked_legacy_settings as source
where source.source_rank = 1
  and source.menu_id = menu.id
  and coalesce(menu.settings_json, '{}'::jsonb) = '{}'::jsonb;

do $$
declare
  trouvable_settings jsonb;
begin
  select menu.settings_json
    into trouvable_settings
  from public.restaurants as restaurant
  join public.menus as menu
    on menu.restaurant_id = restaurant.id
  where restaurant.slug = 'trouvable'
    and menu.is_primary is true
  limit 1;

  if found then
    if trouvable_settings is null
      or trouvable_settings ->> 'publicMenuStyle' is distinct from 'trouvable'
      or trouvable_settings ->> 'defaultThemeMode' is distinct from 'dark'
      or trouvable_settings ->> 'allowThemeToggle' is distinct from 'true' then
      raise exception
        'Trouvable legacy public menu settings were not restored as expected';
    end if;
  end if;
end $$;
