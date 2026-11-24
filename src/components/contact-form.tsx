"use client";

import type { FormEvent } from "react";

type ContactFormLabels = {
  name: string;
  surname: string;
  email: string;
  phone: string;
  message: string;
  submit: string;
};

export function ContactForm({ labels, subject }: { labels: ContactFormLabels; subject: string }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = [
      `${labels.name}: ${String(data.get("name") ?? "")}`,
      `${labels.surname}: ${String(data.get("surname") ?? "")}`,
      `${labels.email}: ${String(data.get("email") ?? "")}`,
      `${labels.phone}: ${String(data.get("phone") ?? "")}`,
      "",
      String(data.get("message") ?? ""),
    ].join("\n");
    window.location.href = `mailto:info.hibetterlife@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="info-form" onSubmit={submit}>
      <div className="info-form-row">
        <label>{labels.name}<input name="name" autoComplete="given-name" maxLength={400} required /></label>
        <label>{labels.surname}<input name="surname" autoComplete="family-name" maxLength={400} required /></label>
      </div>
      <label>{labels.email}<input type="email" name="email" autoComplete="email" maxLength={400} required /></label>
      <label>{labels.phone}<input type="tel" name="phone" autoComplete="tel" maxLength={400} required /></label>
      <label>{labels.message}<textarea name="message" rows={6} maxLength={2000} /></label>
      <button className="button primary-button" type="submit">{labels.submit}</button>
    </form>
  );
}
