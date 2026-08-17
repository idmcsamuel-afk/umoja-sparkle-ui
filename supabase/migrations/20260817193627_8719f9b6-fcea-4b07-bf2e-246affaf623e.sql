DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'open_tender_syndicate','set_tender_syndicate_status','invite_to_tender_syndicate',
      'apply_to_tender_syndicate','respond_tender_syndicate_member','tender_syndicates_for_tender',
      'get_tender_syndicate','tender_syndicate_thread','post_tender_syndicate_message',
      'tender_syndicate_docs','add_tender_syndicate_document','my_tender_syndicates',
      'is_syndicate_member','is_syndicate_originator','syndicates_enabled'
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;