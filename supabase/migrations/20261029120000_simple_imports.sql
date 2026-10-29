-- Imports go live when applied.
--
-- Applying an import now saves its rows and then puts them on the site
-- straight away (through sync_product, publish_category and publish_finish),
-- so there is no applied-but-unpublished state to undo. The undo is removed.
--
-- mapping_presets, the saved column mappings, is no longer read or written
-- by the dashboard. It is left in place, with whatever it holds, so nothing
-- is lost; a later clean-up can drop it.

drop function public.discard_import(uuid);
