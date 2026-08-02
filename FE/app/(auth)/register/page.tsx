import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  return (
    <RegisterForm
      initialEmail={params.email ?? ""}
      redirectPath={params.redirect ?? ""}
    />
  );
}
