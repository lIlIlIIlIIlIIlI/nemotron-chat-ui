CREATE TABLE users (id text PRIMARY KEY, email text NOT NULL COLLATE NOCASE UNIQUE, name text NOT NULL, password_hash text NOT NULL, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE TABLE sessions (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at integer NOT NULL, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE INDEX sessions_user_idx ON sessions(user_id);
--> statement-breakpoint
CREATE TABLE providers (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL, type text NOT NULL, base_url text NOT NULL, chat_endpoint text NOT NULL DEFAULT '/chat/completions', models_endpoint text NOT NULL DEFAULT '/models', icon text, is_enabled integer NOT NULL DEFAULT 1, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE INDEX providers_user_idx ON providers(user_id);
--> statement-breakpoint
CREATE TABLE api_credentials (provider_id text PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE, encrypted_api_key text NOT NULL, key_last_four text NOT NULL, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE TABLE ai_models (id text PRIMARY KEY, provider_id text NOT NULL REFERENCES providers(id) ON DELETE CASCADE, model_id text NOT NULL, display_name text NOT NULL, description text NOT NULL DEFAULT '', context_window integer NOT NULL DEFAULT 32768, max_output_tokens integer NOT NULL DEFAULT 4096, capabilities text NOT NULL DEFAULT '["text"]', supported_options text NOT NULL DEFAULT '["temperature","topP","maxTokens"]', output_token_param text NOT NULL DEFAULT 'max_tokens', reasoning_style text NOT NULL DEFAULT 'none', is_enabled integer NOT NULL DEFAULT 1, is_favorite integer NOT NULL DEFAULT 0, last_used_at integer, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE UNIQUE INDEX model_provider_unique ON ai_models(provider_id, model_id);
--> statement-breakpoint
CREATE TABLE projects (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL, description text NOT NULL DEFAULT '', instructions text NOT NULL DEFAULT '', created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE INDEX projects_user_idx ON projects(user_id);
--> statement-breakpoint
CREATE TABLE conversations (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, project_id text REFERENCES projects(id) ON DELETE SET NULL, title text NOT NULL DEFAULT '새 대화', default_model_id text REFERENCES ai_models(id) ON DELETE SET NULL, system_prompt text NOT NULL DEFAULT '', active_leaf_id text, is_pinned integer NOT NULL DEFAULT 0, is_archived integer NOT NULL DEFAULT 0, created_at integer NOT NULL DEFAULT (unixepoch() * 1000), updated_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE INDEX conversations_user_date_idx ON conversations(user_id, updated_at DESC);
--> statement-breakpoint
CREATE TABLE messages (id text PRIMARY KEY, conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, parent_message_id text, role text NOT NULL CHECK(role IN ('system','user','assistant','tool')), content text NOT NULL DEFAULT '', model_id text REFERENCES ai_models(id) ON DELETE SET NULL, provider_id text REFERENCES providers(id) ON DELETE SET NULL, status text NOT NULL DEFAULT 'complete', metadata text NOT NULL DEFAULT '{}', created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE INDEX messages_conversation_idx ON messages(conversation_id);
--> statement-breakpoint
CREATE INDEX messages_parent_idx ON messages(parent_message_id);
--> statement-breakpoint
CREATE TABLE attachments (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, conversation_id text REFERENCES conversations(id) ON DELETE CASCADE, message_id text REFERENCES messages(id) ON DELETE CASCADE, project_id text REFERENCES projects(id) ON DELETE CASCADE, name text NOT NULL, mime_type text NOT NULL, size integer NOT NULL, data text NOT NULL DEFAULT '', extracted_text text, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE INDEX attachments_user_idx ON attachments(user_id);
--> statement-breakpoint
CREATE TABLE user_settings (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, value text NOT NULL);
--> statement-breakpoint
CREATE TABLE memories (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, content text NOT NULL, enabled integer NOT NULL DEFAULT 1, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE TABLE shared_conversations (id text PRIMARY KEY, conversation_id text NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE, title text NOT NULL, snapshot text NOT NULL, created_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE TABLE artifacts (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE, name text NOT NULL, language text NOT NULL, versions text NOT NULL, updated_at integer NOT NULL DEFAULT (unixepoch() * 1000));
--> statement-breakpoint
CREATE TABLE rate_limits (key text PRIMARY KEY, count integer NOT NULL, reset_at integer NOT NULL);
--> statement-breakpoint
CREATE INDEX rate_limits_reset_idx ON rate_limits(reset_at);
--> statement-breakpoint
CREATE TABLE attachment_chunks (attachment_id text NOT NULL REFERENCES attachments(id) ON DELETE CASCADE, part integer NOT NULL, data text NOT NULL, PRIMARY KEY (attachment_id, part));
--> statement-breakpoint
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
--> statement-breakpoint
CREATE INDEX attachments_project_idx ON attachments(project_id);
--> statement-breakpoint
CREATE INDEX attachments_conversation_idx ON attachments(conversation_id);
--> statement-breakpoint
CREATE INDEX memories_user_idx ON memories(user_id);
--> statement-breakpoint
CREATE INDEX artifacts_user_message_idx ON artifacts(user_id, message_id);
