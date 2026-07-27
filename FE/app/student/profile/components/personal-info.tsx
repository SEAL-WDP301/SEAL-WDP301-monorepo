import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";

const fields = [
    {
        label: "Full name",
        value: "Nguyễn Minh Khoa",
    },
    {
        label: "Email",
        value: "khoanmse171234@fpt.edu.vn",
    },
    {
        label: "Student ID",
        value: "SE171234",
    },
    {
        label: "Phone",
        value: "+84 90 123 4567",
    },
    {
        label: "University",
        value: "FPT University HCMC",
    },
    {
        label: "Major",
        value: "Software Engineering",
    },
];

export function PersonalInformation() {
    return (
        <GlassCard>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                    Personal Information
                </h3>

                <Button size="sm">
                    <Save className="h-3.5 w-3.5" />
                    Save
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {fields.map((field) => (
                    <div key={field.label}>
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {field.label}
                        </Label>

                        <Input
                            defaultValue={field.value}
                            className="mt-2"
                        />
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}