-- Storage blocks deletes from the storage tables. Files are removed through the Storage API.

drop trigger if exists documents_delete_object on public.documents;
drop function if exists public.delete_document_object();
