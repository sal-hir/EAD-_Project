package com.swiftdrop.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.*;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class SmtpRecoveryMailer implements RecoveryMailer {
    private final JavaMailSender sender;
    private final String host,from;
    public SmtpRecoveryMailer(JavaMailSender sender,@Value("${spring.mail.host:}") String host,@Value("${app.mail-from:}") String from){this.sender=sender;this.host=host;this.from=from;}
    @Override public void send(String email,String url){
        if(host.isBlank()||from.isBlank())throw new MailSendException("Recovery email is not configured");
        SimpleMailMessage message=new SimpleMailMessage();message.setFrom(from);message.setTo(email);
        message.setSubject("SwiftDrop password reset");
        message.setText("A password reset was requested for your SwiftDrop account.\n\nChoose a new password:\n"+url+"\n\nThis link expires in 20 minutes and works once. If you did not request this, ignore this email. Your password has not been changed.\nSwiftDrop");
        sender.send(message);
    }
}
