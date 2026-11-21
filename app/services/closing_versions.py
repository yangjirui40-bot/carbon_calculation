"""Project the submission, return and approval that belong to one inventory revision."""
from sqlalchemy import text


def install(db):
    if db.bind.dialect.name != "postgresql":
        return
    sql = """INSERT INTO public.close_versions(tenant_id, period_id, run_id, revision_no, submitted_by,
                       submitted_at,state,inventory_period_id)
         SELECT p.company_id,r.inventory_id,c.id,e.revision,m.id,e.created_at,'submitted',p.id
         FROM public.inventory_period_events e JOIN public.inventory_periods p ON p.id=e.period_id
         JOIN public.calculation_runs c ON c.run_id=e.run_id AND c.company_id=p.company_id
         LEFT JOIN public.reporting_periods r ON r.inventory_id=p.id
         LEFT JOIN public.tenant_members m ON m.account_id=e.actor_id AND m.tenant_id=p.company_id
         WHERE e.action='submit'"""
    db.execute(text(sql+" ON CONFLICT(inventory_period_id, revision_no) DO NOTHING"))
    db.execute(text("""UPDATE public.close_versions v SET state=hist.action FROM
      (SELECT DISTINCT ON (period_id,revision) period_id,revision,CASE action WHEN 'submit' THEN 'submitted' WHEN 'close' THEN 'closed' WHEN 'reopen' THEN 'reopened' WHEN 'return' THEN 'returned' END AS action FROM public.inventory_period_events
       WHERE action IN ('close','reopen','return','submit') ORDER BY period_id,revision,id DESC) hist
       WHERE hist.period_id=v.inventory_period_id AND hist.revision=v.revision_no AND v.state<>hist.action"""))
    db.execute(text("""UPDATE public.close_actions a SET close_version_id=v.id FROM public.inventory_period_events e,
       public.close_versions v WHERE e.id=a.id AND v.inventory_period_id=e.period_id AND v.revision_no=e.revision
       AND a.close_version_id IS DISTINCT FROM v.id"""))
    db.execute(text(f"""CREATE OR REPLACE FUNCTION public.carbon_track_closing() RETURNS trigger LANGUAGE plpgsql
        SECURITY DEFINER SET search_path=pg_catalog AS $$
        BEGIN
          IF NEW.action='submit' THEN {sql} AND e.id=NEW.id ON CONFLICT(inventory_period_id,revision_no) DO NOTHING;
          ELSIF NEW.action IN ('return','close','reopen') THEN
            UPDATE public.close_versions SET state=CASE NEW.action WHEN 'submit' THEN 'submitted' WHEN 'close' THEN 'closed' WHEN 'reopen' THEN 'reopened' WHEN 'return' THEN 'returned' END WHERE inventory_period_id=NEW.period_id AND revision_no=NEW.revision;
          END IF;
          UPDATE public.close_actions a SET close_version_id=v.id FROM public.close_versions v
            WHERE a.id=NEW.id AND v.inventory_period_id=NEW.period_id AND v.revision_no=NEW.revision;
          RETURN NEW;
        END $$"""))
    db.execute(text("DROP TRIGGER IF EXISTS zz_carbon_track_closing ON public.inventory_period_events"))
    db.execute(text("CREATE TRIGGER zz_carbon_track_closing AFTER INSERT ON public.inventory_period_events FOR EACH ROW EXECUTE FUNCTION public.carbon_track_closing()"))
