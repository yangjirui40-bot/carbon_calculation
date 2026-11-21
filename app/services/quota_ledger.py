"""The accounting journal covers all writers, including maintenance imports."""
from sqlalchemy import text


def install_quota_ledger(conn):
    if conn.dialect.name == "sqlite":
        for action, kind, allocated_before, used_before in (
            ("INSERT", "'allocation'", "0", "0"),
            ("UPDATE", "'adjustment'", "old.allocated_quota", "old.used_quota"),
        ):
            condition = "" if action == "INSERT" else "WHEN old.allocated_quota != new.allocated_quota OR old.used_quota != new.used_quota"
            conn.exec_driver_sql(f"""
                CREATE TRIGGER IF NOT EXISTS quota_entries_{action} AFTER {action} ON carbon_quotas {condition}
                BEGIN INSERT INTO quota_entries(company_id,quota_id,kind,allocated_delta,used_delta,allocated_after,used_after,posted_at)
                VALUES(new.company_id,new.id,{kind},new.allocated_quota-{allocated_before},new.used_quota-{used_before},
                       new.allocated_quota,new.used_quota,CURRENT_TIMESTAMP); END
            """)
    elif conn.dialect.name == "postgresql":
        conn.exec_driver_sql("LOCK TABLE public.carbon_quotas IN SHARE ROW EXCLUSIVE MODE")
        conn.exec_driver_sql("""
          CREATE OR REPLACE FUNCTION public.carbon_post_quota() RETURNS trigger
          LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
          DECLARE a numeric := 0; u numeric := 0; reason text; ref text;
          BEGIN
            IF TG_OP = 'UPDATE' THEN
              a := OLD.allocated_quota::text::numeric; u := OLD.used_quota::text::numeric;
              IF a = NEW.allocated_quota::text::numeric AND u = NEW.used_quota::text::numeric THEN RETURN NEW; END IF;
            END IF;
            ref := nullif(current_setting('carbon.quota_transfer',true),'');
            reason := CASE WHEN ref IS NOT NULL THEN 'transfer'
                           WHEN TG_OP='INSERT' THEN 'allocation'
                           WHEN u <> NEW.used_quota::text::numeric THEN 'usage' ELSE 'adjustment' END;
            INSERT INTO public.quota_entries(company_id,quota_id,kind,reference,allocated_delta,used_delta,allocated_after,used_after,posted_at)
              VALUES(NEW.company_id,NEW.id,reason,ref,NEW.allocated_quota::text::numeric-a,
                     NEW.used_quota::text::numeric-u,NEW.allocated_quota::text::numeric,NEW.used_quota::text::numeric,now());
            RETURN NEW;
          END $$
        """)
        conn.exec_driver_sql("DROP TRIGGER IF EXISTS quota_journal ON public.carbon_quotas")
        conn.exec_driver_sql("CREATE TRIGGER quota_journal AFTER INSERT OR UPDATE OF allocated_quota, used_quota ON public.carbon_quotas FOR EACH ROW EXECUTE FUNCTION public.carbon_post_quota()")
    conn.exec_driver_sql("""
        INSERT INTO quota_entries(company_id,quota_id,kind,allocated_delta,used_delta,allocated_after,used_after,posted_at)
        SELECT q.company_id,q.id,'opening_balance',q.allocated_quota,q.used_quota,q.allocated_quota,q.used_quota,CURRENT_TIMESTAMP
        FROM carbon_quotas q WHERE NOT EXISTS (SELECT 1 FROM quota_entries e WHERE e.quota_id=q.id)
    """)


def tag_transfer(db, reference):
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT set_config('carbon.quota_transfer',:ref,true)"), {"ref": reference})
