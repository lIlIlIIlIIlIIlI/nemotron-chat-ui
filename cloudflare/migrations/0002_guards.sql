-- Constraints are checked inside the write transaction, including concurrent requests.
--> statement-breakpoint
CREATE TRIGGER attachment_quota BEFORE INSERT ON attachments
WHEN (SELECT coalesce(sum(size),0) FROM attachments WHERE user_id = NEW.user_id) + NEW.size > 52428800
BEGIN SELECT RAISE(ABORT, 'STORAGE_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER message_limit BEFORE INSERT ON messages
WHEN (SELECT count(*) FROM messages WHERE conversation_id = NEW.conversation_id) >= 1000
BEGIN SELECT RAISE(ABORT, 'CONVERSATION_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER one_generation BEFORE INSERT ON messages
WHEN NEW.status = 'streaming' AND EXISTS (
  SELECT 1 FROM messages WHERE conversation_id = NEW.conversation_id
  AND status = 'streaming' AND created_at > (unixepoch() * 1000) - 150000
)
BEGIN SELECT RAISE(ABORT, 'GENERATING'); END;

--> statement-breakpoint
CREATE TRIGGER memory_limit BEFORE INSERT ON memories
WHEN (SELECT count(*) FROM memories WHERE user_id = NEW.user_id) >= 100
BEGIN SELECT RAISE(ABORT, 'MEMORY_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER artifact_version_limit BEFORE UPDATE OF versions ON artifacts
WHEN json_array_length(NEW.versions) > 50 OR length(CAST(NEW.versions AS BLOB)) > 1000000
BEGIN SELECT RAISE(ABORT, 'VERSION_LIMIT'); END;
