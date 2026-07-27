/* eslint-disable @typescript-eslint/no-explicit-any */
"use no memo";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { enqueueSnackbar } from "notistack";
import { axiosClient } from "@/lib/axios";

// Zod schemas
const studentSchema = z.object({
  studentType: z.enum(["fpt", "external"]),
  studentCode: z.string().min(1, "Student ID is required"),
  universityName: z.string().optional(),
  phone: z.string().optional(),
  githubUsername: z.string().min(1, "GitHub Username is required"),
});

const stakeholderSchema = z.object({
  jobTitle: z.string().optional(),
  organization: z.string().optional(),
  experience: z.string().optional(),
  achievements: z.string().optional(),
  bio: z.string().optional(),
});

export function ProfileCompletionModal({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange?: (open: boolean) => void }) {
  const [activeTab, setActiveTab] = useState("student");
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const studentForm = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: { studentType: "fpt", studentCode: "", universityName: "Đại học FPT", phone: "", githubUsername: "" },
  });

  const watchStudentType = studentForm.watch("studentType");

  const stakeholderForm = useForm<z.infer<typeof stakeholderSchema>>({
    resolver: zodResolver(stakeholderSchema),
    defaultValues: { jobTitle: "", organization: "", experience: "", achievements: "", bio: "" },
  });

  const onStudentSubmit = async (values: z.infer<typeof studentSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        universityName: values.studentType === "fpt" ? "FPT University" : values.universityName,
      };
      await axiosClient.put("/users/profile/student", payload);
      enqueueSnackbar("Student profile updated successfully.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      onOpenChange?.(false);
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.message || "Error when updating profile", { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onStakeholderSubmit = async (values: z.infer<typeof stakeholderSchema>) => {
    setIsSubmitting(true);
    try {
      await axiosClient.put("/users/profile/stakeholder", values);
      enqueueSnackbar("Stakeholder profile updated successfully.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      onOpenChange?.(false);
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.message || "Error when updating profile", { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please select your role and provide the required information to continue using the system.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student">Student</TabsTrigger>
            <TabsTrigger value="stakeholder">Partner / Organization</TabsTrigger>
          </TabsList>

          <TabsContent value="student">
            <Form {...studentForm}>
              <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={studentForm.control}
                  name="studentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>University</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a university">
                              {(val: string | null) =>
                                val === "fpt" ? "FPT University" :
                                  val === "external" ? "Other University" :
                                    "Select a university"
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fpt" >FPT University</SelectItem>
                          <SelectItem value="external">Other University</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="studentCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student ID (*)</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g: SE123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchStudentType === "external" && (
                  <FormField
                    control={studentForm.control}
                    name="universityName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>University Name (*)</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g. Ho Chi Minh City University of Technology" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={studentForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g: 0987654321" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="githubUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub Username (*)</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g: octocat" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save sttudent profile"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="stakeholder">
            <Form {...stakeholderForm}>
              <form onSubmit={stakeholderForm.handleSubmit(onStakeholderSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={stakeholderForm.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job title</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g: CEO, Manager, Developer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stakeholderForm.control}
                  name="organization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization / Company</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g: FPT Software" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stakeholderForm.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g: 5 years in the field of AI" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stakeholderForm.control}
                  name="achievements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Achievements</FormLabel>
                      <FormControl>
                        <Input placeholder="Key achievements..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stakeholderForm.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Bio</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Tell us about yourself..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save parner profile"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
