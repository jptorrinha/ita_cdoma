# Caso de Monte Carlo — disco de turbina
# Implementação de referência para reprodução e replicação em aula.
# Caso mitigado: inspecao_programada <- 3000 e eficiencia_manutencao <- 0.95.

###### Dados de entrada ######

beta_turbina <- 3.5
eta_turbina <- 85000

beta_itt <- 2
eta_itt <- 14000

vida_limite_comp <- 25000

horas_mes <- 300
horas_ano <- horas_mes * 12
anos_sim <- 20

horas_total <- anos_sim * horas_ano

inspecao_programada <- 6000
eficiencia_manutencao <- 0.75

set.seed(10)

populacao <- data.frame(
 horas_iniciais = c(
   rep(25,118), rep(75,14), rep(125,39), rep(175,44), rep(225,34),
   rep(275,34), rep(325,47), rep(375,53), rep(425,45), rep(475,50),
   rep(525,43), rep(575,40), rep(625,29), rep(675,44), rep(725,43),
   rep(775,39), rep(825,44), rep(875,40), rep(925,45), rep(975,44),
   rep(1025,47), rep(1075,55), rep(1125,57), rep(1175,66), rep(1225,58),
   rep(1275,59), rep(1325,51), rep(1375,67), rep(1425,59), rep(1475,50),
   rep(1525,72), rep(1575,56), rep(1625,32), rep(1675,31), rep(1725,35),
   rep(1775,24), rep(1825,15), rep(1875,15), rep(1925,13), rep(1975,7),
   rep(2025,4), rep(2075,5), rep(2125,5), rep(2175,3), rep(2225,3),
   rep(2475,1)
 )

)

stopifnot(nrow(populacao) == 1779)

###########################################################
vetor_horas_meses <- cumsum(rep(horas_mes,anos_sim*12))*nrow(populacao) #Soma cumulativa de horas_mes

###### Funções ######

tempo_weibull <- function(beta, eta, T_part) {
 #rweibull(1, shape = beta, scale = eta)
 Ft <- runif(length(T_part))*(1-pweibull(T_part,beta,eta))+pweibull(T_part,beta,eta)
 return(exp(log(eta)+(1/beta)*log(-log(1-Ft)))) # retorna o tempo da falha

}
cont<-0
simular_motor <- function(horas_iniciais) {

          cont<<-cont+1
          cat(cont,"\r")
          tam <- length(horas_iniciais)
          falhas <- 0L

          prox_fim_vida <- rep(vida_limite_comp,tam)-horas_iniciais #Horas até o final da vida a partir das horas atuais

          prox_itt <- tempo_weibull(beta_itt, eta_itt,horas_iniciais)-horas_iniciais #Horas até o proximo itt a partir das horas atuais

          prox_falha <- tempo_weibull(beta_turbina, eta_turbina,horas_iniciais)-horas_iniciais #Horas até a proxima falha a partir das horas atuais

          prox_prog <- rep(inspecao_programada,tam)-horas_iniciais #Horas até a proxima manutenção programada a partir das horas atuais

          vet_meses_falha <- integer(anos_sim*12) #gera vetor de falhas por mes
          nao_chegou_final=1L
          while (nao_chegou_final) {#Roda a simulação de falha e reparos até que todos os motores tenham chegado ao final da simulação (horas_total)

                     hora_evento <- pmin(prox_falha, prox_itt, prox_prog,prox_fim_vida,horas_total) #Calcula eventos que ocorrerão primeiro

                     i_falha <- hora_evento == prox_falha #posições onde hora_evento é prox_falha
                     i_ittprog_commanut <- ((hora_evento == prox_itt) | (hora_evento == prox_prog)) & (runif(tam) < eficiencia_manutencao) # posições onde itt ou prog com manut efetiva
                     i_fim_vida <- hora_evento == prox_fim_vida #posições onde hora_evento é prox_fim_vida
                     i_nao_final <- hora_evento < horas_total #indices que ainda não atingiram final da simulação

                     #Para os casos que houve falha
                     falhas <- falhas + sum(i_falha) #conta as falhas totais
                     meses_falha <- as.integer((hora_evento[i_falha] - 1) %/% horas_mes) + 1L #Calcula os meses (mantendo tudo como inteiro) onde deu falha para todos os motores que falharam
                     meses_falha <- pmax.int(1L, pmin.int(anos_sim*12, meses_falha)) # limita o menor mes a 1 e o maior mês a anos_sim*12.
                     vet_meses_falha <- vet_meses_falha + tabulate(meses_falha, nbins = anos_sim*12) #Transforma o vetor de meses onde houve falha (meses_falha), em um único vetor, onde cada índice é um mês e o conteúdo é o total de vezes que aparece em meses_falha

                     #Para os casos que houve falha ou chegou ao fim da vida
                     prox_fim_vida[i_falha | i_fim_vida] <- hora_evento[i_falha | i_fim_vida]+vida_limite_comp #Ajusta prox_fim_vida

                     #Para os casos que houve falha ou chegou ao fim da vida ou Manutenção foi efetiva em ITT ou Prog.

                     prox_falha[i_falha | i_fim_vida | i_ittprog_commanut] <- hora_evento[i_falha | i_fim_vida | i_ittprog_commanut]+rweibull(sum(i_falha | i_fim_vida | i_ittprog_commanut, na.rm = TRUE),beta_turbina, eta_turbina)

                     nao_chegou_final=sum(i_nao_final) #quantos itens ainda não chegaram às horas totais de simulação

                     #Para todos os casos que não chegaram ao final, gera novo tempo de itt e programada.
                     prox_prog[i_nao_final] <- hora_evento[i_nao_final]+inspecao_programada #ajusta o proximo tempo de inspeção
                     prox_itt[i_nao_final] <- hora_evento[i_nao_final]+rweibull(nao_chegou_final,beta_itt, eta_itt) # calcula proximo itt, para um componente que tem vida 0 neste momento
          }

          return(c(falhas = falhas, vet_meses_falha))
}

###### Simulação e resultados ######

n_rep <- 1000 # Modo rápido em aula; use 10000 para reproduzir a referência.
resultados_mc <- replicate(n_rep, simular_motor(populacao$horas_iniciais))
#resultados_mc <- replicate(n_rep, sapply(populacao$horas_iniciais, simular_motor))

media_total_frota<-mean(resultados_mc[1, ]) #primeira linha é o total de falhas
vetor_falhas_meses <- rowSums(resultados_mc[-1, , drop = FALSE]) #resultados_mc[-1, , drop = FALSE] remove primeira linha e mantem estrutura matricial

vetor_falhas_medias_acumuladas_meses <- cumsum(vetor_falhas_meses/n_rep)
FR=vetor_falhas_medias_acumuladas_meses/vetor_horas_meses
plot(vetor_horas_meses,FR,type = "l",ylim = c(0,max(FR)*1.01))

cat(sprintf("Média do total de falhas da frota (Monte Carlo, %d repetições): %.3f\n",
         n_rep, media_total_frota))
