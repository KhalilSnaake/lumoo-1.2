import { useAuth } from "@lumoo/core";
import { AuthForm } from "@/components/auth-form";
import { AccountProfile } from "@/components/account-profile";

export default function CompteScreen() {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <AccountProfile /> : <AuthForm />;
}
