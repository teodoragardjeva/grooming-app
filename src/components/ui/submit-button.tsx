"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Submit button for <form action={serverAction}>: shows a spinner and blocks double clicks while the action runs. */
export function SubmitButton({ children, ...props }: Omit<ButtonProps, "type" | "loading" | "asChild">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props}>{children}</Button>;
}
