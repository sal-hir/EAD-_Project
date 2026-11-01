package com.swiftdrop.auth;

import com.swiftdrop.auth.service.SmtpRecoveryMailer;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mail.*;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import static org.assertj.core.api.Assertions.*;

class RecoveryMailerTest {
    @Test void recoveryEmailContainsSingleUseLinkAndExpiryWithoutAPassword(){
        var captured=new AtomicReference<SimpleMailMessage>();
        var sender=new JavaMailSenderImpl(){@Override public void send(SimpleMailMessage message){captured.set(message);}};
        String link="http://localhost:3000/reset-password#token=test-one-use-token";
        new SmtpRecoveryMailer(sender,"smtp-sandbox.example","noreply@example.lk").send("recipient@example.lk",link);
        assertThat(captured.get().getSubject()).contains("SwiftDrop");
        assertThat(captured.get().getText()).contains(link,"20 minutes","ignore this email").doesNotContain("newPassword");
        assertThat(captured.get().getTo()).containsExactly("recipient@example.lk");
    }
    @Test void unconfiguredAndFailedSmtpSendAreExplicitlyRejected(){
        assertThatThrownBy(()->new SmtpRecoveryMailer(new JavaMailSenderImpl(),"","").send("recipient@example.lk","link")).isInstanceOf(MailSendException.class);
        var failed=new JavaMailSenderImpl(){@Override public void send(SimpleMailMessage message){throw new MailSendException("Simulated transport failure");}};
        assertThatThrownBy(()->new SmtpRecoveryMailer(failed,"sandbox.example","noreply@example.lk").send("recipient@example.lk","link")).isInstanceOf(MailSendException.class);
    }
}
