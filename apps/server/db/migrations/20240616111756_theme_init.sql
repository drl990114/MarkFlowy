create table if not exists theme_ (
  id UUID PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  name VARCHAR(255) NOT NULL,
  author_id UUID REFERENCES user_(id) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  cover_image_url TEXT NOT NULL,
  npm_package_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
