-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create agreement types table
CREATE TABLE public.agreement_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  cognito_form_url TEXT,
  requires_kyc BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default agreement types
INSERT INTO public.agreement_types (name, description, requires_kyc, display_order) VALUES
('KYC/AML Policy', 'Complete your Know Your Customer and Anti-Money Laundering verification', false, 1),
('Property Pledge Agreement', 'Agreement to pledge property for tokenization', true, 2),
('Token Issuance Agreement', 'Terms for token issuance and creation', true, 3),
('Subscription Agreement', 'Investment subscription terms and conditions', true, 4),
('Operating Agreement (SPV/LLC)', 'Special Purpose Vehicle operating agreement', true, 5),
('Token Holder Agreement', 'Rights and responsibilities as a token holder', true, 6),
('Custody & Tokenization Policy', 'Asset custody and tokenization procedures', true, 7),
('Swap/Settlement Agreement', 'Token swap and settlement terms', true, 8);

-- Enable RLS on agreement_types
ALTER TABLE public.agreement_types ENABLE ROW LEVEL SECURITY;

-- Create user agreements table (tracks user progress)
CREATE TABLE public.user_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_type_id UUID NOT NULL REFERENCES public.agreement_types(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'approved', 'rejected')),
  cognito_submission_id TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, agreement_type_id)
);

-- Enable RLS on user_agreements
ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create RLS policies for agreement_types (readable by all authenticated users)
CREATE POLICY "Authenticated users can view agreement types" 
ON public.agreement_types 
FOR SELECT 
TO authenticated 
USING (is_active = true);

CREATE POLICY "Admins can manage agreement types" 
ON public.agreement_types 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create RLS policies for user_agreements
CREATE POLICY "Users can view their own agreements" 
ON public.user_agreements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own agreements" 
ON public.user_agreements 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agreements" 
ON public.user_agreements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all user agreements" 
ON public.user_agreements 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_agreements_updated_at
  BEFORE UPDATE ON public.user_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();