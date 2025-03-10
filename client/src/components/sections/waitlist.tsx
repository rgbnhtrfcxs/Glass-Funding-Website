import { useState } from "react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { insertWaitlistSchema, type InsertWaitlist } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function Waitlist() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<InsertWaitlist>({
    resolver: zodResolver(insertWaitlistSchema),
    defaultValues: {
      name: "",
      email: ""
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertWaitlist) => {
      try {
        const res = await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": import.meta.env.VITE_BREVO_API_KEY,  // Use environment variable for API key
          },
          body: JSON.stringify({
            email: data.email,
            attributes: {
              FIRSTNAME: data.name,  // Standard field for name in Brevo
            },
            listIds: [import.meta.env.VITE_LIST_ID],  // Replace with actual List ID from Brevo
            updateEnabled: true,  // Update if subscriber already exists
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to add to Brevo waitlist");
        }

        const result = await res.json();
        return result;
      } catch (error) {
        console.error("Error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Success!",
        description: "You've been added to the waitlist.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again.",
      });
    },
  });

  const onSubmit = (data: InsertWaitlist) => {
    mutation.mutate(data);
  };

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-lg mx-auto text-center"
        >
          <h2 className="text-3xl font-bold mb-4">Join the Waitlist</h2>
          <p className="text-muted-foreground mb-8">
            Be the first to know when Glass launches and get early access to our platform.
          </p>

          {submitted ? (
            <div className="text-center p-6 bg-primary/10 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Thank you for joining!</h3>
              <p className="text-muted-foreground">
                We'll keep you updated on our progress.
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="email" placeholder="Your email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Joining..." : "Join Now"}
                </Button>
              </form>
            </Form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
