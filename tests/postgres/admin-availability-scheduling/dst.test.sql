select pg_temp.assert_true(('2026-03-08 02:30'::timestamp at time zone 'America/Toronto') = ('2026-03-08 03:30'::timestamp at time zone 'America/Toronto'),'Toronto gap normalizes and must be rejected by HTTP parser');
select pg_temp.assert_true(extract(timezone from ('2026-11-01 01:30 EDT'::timestamptz)) = 0,'timestamps persist as absolute instants');
