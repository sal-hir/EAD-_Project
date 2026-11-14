package com.swiftdrop.merchant.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.merchant.client.IdentityGateway;
import com.swiftdrop.merchant.exception.*;
import com.swiftdrop.merchant.service.ApiKeyService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class IdentityFilter extends OncePerRequestFilter {
    private final IdentityGateway identities;private final ObjectMapper mapper;private final ApiKeyService keys;
    public IdentityFilter(IdentityGateway identities,ObjectMapper mapper,ApiKeyService keys){this.identities=identities;this.mapper=mapper;this.keys=keys;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
        if(request.getRequestURI().startsWith("/actuator/health")||"OPTIONS".equals(request.getMethod())){chain.doFilter(request,response);return;}
        if(request.getRequestURI().startsWith("/api/v1/merchant-api/")){
            try{
                var headers=java.util.Collections.list(request.getHeaders("X-API-Key"));
                if(headers.size()!=1||request.getHeader("Authorization")!=null)throw new ApiFailure(401,"A single X-API-Key header is required");
                var identity=keys.validate(headers.getFirst());
                SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                    identity,null,List.of(new SimpleGrantedAuthority("ROLE_MERCHANT_API"))));
            }catch(ApiFailure failure){ApiErrors.write(mapper,response,failure.status(),failure.getMessage());return;}
            catch(org.springframework.dao.DataAccessException unavailable){ApiErrors.write(mapper,response,503,"Credential validation unavailable");return;}
            chain.doFilter(request,response);return;
        }
        String header=request.getHeader("Authorization");
        if(header==null||!header.startsWith("Bearer ")||header.length()>8192){ApiErrors.write(mapper,response,401,"Authentication required");return;}
        try{
            var caller=identities.validate(header.substring(7));
            SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(caller,null,List.of(new SimpleGrantedAuthority("ROLE_"+caller.role()))));
        }catch(ApiFailure failure){ApiErrors.write(mapper,response,failure.status(),failure.getMessage());return;}
        chain.doFilter(request,response);
    }
}
