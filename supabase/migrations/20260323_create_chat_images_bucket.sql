-- Create storage bucket for chat images
-- Run this in Supabase SQL Editor

-- Enable storage
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  public BOOLEAN DEFAULT true,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert chat-images bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-images', 'chat-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create storage objects table
CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bucket_id, name)
);

-- RLS for storage
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload their own images
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-images' 
    AND auth.uid() IS NOT NULL
  );

-- Policy: Allow users to view their own images
CREATE POLICY "Allow users to view own images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-images'
  );

-- Policy: Allow users to delete their own images
CREATE POLICY "Allow users to delete own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-images'
    AND auth.uid() IS NOT NULL
  );
