-- Allow gestor-plantoes (and super) in profiles.role
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  -- Recreate constraint with expanded set of allowed roles
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'admin', 'gestor-plantoes', 'super'));
END $$;
