-- ============================================================
-- Supabase 数据库建表 SQL
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 单词表
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  english TEXT NOT NULL,
  chinese TEXT NOT NULL,
  breakdown TEXT DEFAULT '',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'mastered')),
  correct_streak INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_wrong INTEGER DEFAULT 0,
  last_correct_date DATE,
  last_answer_correct BOOLEAN DEFAULT false,
  mastered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户学习状态表
CREATE TABLE user_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_dates JSONB DEFAULT '[]'::jsonb,
  daily_review_count JSONB DEFAULT '{}'::jsonb,
  today_mastered_count INTEGER DEFAULT 0,
  today_studied_count INTEGER DEFAULT 0,
  quiz_session_word_count INTEGER DEFAULT 0,
  quiz_session_words JSONB DEFAULT '[]'::jsonb,
  last_quiz_date DATE,
  last_passage_at INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全（RLS）
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "words_own_access" ON words
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "state_own_access" ON user_state
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 索引
CREATE INDEX idx_words_user_id ON words(user_id);
CREATE INDEX idx_words_status ON words(user_id, status);
CREATE INDEX idx_words_updated ON words(user_id, updated_at DESC);
