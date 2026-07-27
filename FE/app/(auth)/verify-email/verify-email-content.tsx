import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthHeader } from "../_components/auth-card";
import { OtpInput } from "../_components/otp-input";
import { axiosClient } from "@/lib/axios";
import { enqueueSnackbar } from "notistack";

export default function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      enqueueSnackbar("Không tìm thấy email. Vui lòng đăng ký lại.", { variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await axiosClient.post("/auth/verify-otp", {
        email,
        otp,
      });

      enqueueSnackbar(res.data?.message || "Xác thực thành công!", { variant: "success" });
      router.push("/login");
    } catch (error: unknown) {
      enqueueSnackbar(
        isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message || "Mã OTP không hợp lệ hoặc đã hết hạn."
          : "Mã OTP không hợp lệ hoặc đã hết hạn.",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      <div className="space-y-5">
        <AuthHeader
          title="Xác thực Email"
          subtitle={`Mã OTP gồm 6 chữ số đã được gửi đến ${email || 'email của bạn'}`}
        />

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="pt-2">
            <OtpInput value={otp} onChange={setOtp} />
          </div>

          <div className="pt-2 flex justify-center">
            <Button
              variant="authPrimary"
              size="auth"
              className="w-full min-w-[200px] font-bold sm:w-auto"
              type="submit"
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin mx-auto" />
              ) : (
                <>Xác nhận <ArrowRight className="size-4" /></>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AuthCard>
  );
}
