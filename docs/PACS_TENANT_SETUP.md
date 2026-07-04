# 🏢 Ops — VM compartilhada multi-tenant (`orthanc-server`)

> Como migrar a VM `orthanc-server` para **multi-tenant** e criar tenants (planos
> Starter/Pro). Cada tenant = 1 container Orthanc isolado. Ver desenho em
> [PLANO_PACS_VM_COMPARTILHADA.md](./PLANO_PACS_VM_COMPARTILHADA.md).

## Pré-requisitos
- VM já montada pelo `setup-vm.sh` (Docker + Tailscale + Agente + Funnel).
- Agente atualizado (`scripts/agent.js` **tenant-aware**) e `scripts/pacs-tenant.sh` copiados para a VM.
  ```bash
  gcloud compute scp scripts/agent.js scripts/generate_wl.py scripts/pacs-tenant.sh \
    orthanc-server:~ --zone=southamerica-east1-c
  sudo cp ~/agent.js ~/generate_wl.py /opt/laudus-agent/
  sudo cp ~/pacs-tenant.sh /opt/ && sudo chmod +x /opt/pacs-tenant.sh
  ```

## 1. Ligar o modo multi-tenant no Agente
Edite o serviço systemd do agente (`/etc/systemd/system/laudus-agent.service`) e
troque as variáveis para o modo multi-tenant:
```ini
Environment=PORT=3000
Environment=LAUDUS_TENANTS_DIR=/opt/tenants
# (remova LAUDUS_WORKLIST_DIR e LAUDUS_AGENT_SECRET — no multi-tenant o segredo é por tenant)
```
Recarregue e reinicie:
```bash
sudo systemctl daemon-reload && sudo systemctl restart laudus-agent
curl -s https://orthanc-server.tail861dda.ts.net/ | grep multi-tenant   # deve aparecer
```
> O Orthanc "default" da `setup-vm.sh` (portas 8042/4242) pode ser **desligado**
> (`docker rm -f orthanc`) — no modo multi-tenant só os containers por tenant
> (`orthanc-<id>`) são usados. Faça backup do volume antes, se houver dados.

## 2. Criar o primeiro tenant
```bash
sudo TS_NET=tail861dda.ts.net /opt/pacs-tenant.sh create        # id/plan automáticos
# ou:  sudo /opt/pacs-tenant.sh create clinicaA pro
```
A saída imprime os **dados para o app**:
```
dicomTenantId      = tXXXXXX
dicomAgentSecret   = <segredo>
dicomLocalAgentUrl = https://orthanc-server.tail861dda.ts.net
Porta DICOM (relé) = 43xx   → aparelho aponta p/ <IP-tailnet>:43xx
AE Title           = ORTHANC
```

## 3. Configurar no app
No usuário (Configurações → PACS/DICOM), preencha `dicomTenantId`, `dicomAgentSecret`
e `dicomLocalAgentUrl` com os valores acima. (Na automação — S2b/F6 — isso será
gravado sozinho pelo provisionador; por ora, manual.)

## 4. Apontar o aparelho (via relé)
No ultrassom (Worklist + Storage): **IP do relé** na LAN, **porta = a porta DICOM
do tenant** (`43xx`), **AE = ORTHANC**. C-ECHO deve dar sucesso.

## Comandos úteis
```bash
/opt/pacs-tenant.sh list              # lista tenants (não precisa root)
sudo /opt/pacs-tenant.sh remove <id>  # remove container; move dados p/ /opt/tenants-removed
docker stats --no-stream              # uso de CPU/RAM por container
```

## Segurança (checklist S4 — próximo)
- [ ] Disco de dados separado do boot montado em `/opt/tenants` + snapshots diários.
- [ ] Firewall GCP: nenhuma porta pública (só Tailscale). As portas `43xx` ficam
      acessíveis apenas via tailnet ao relé de cada cliente.
- [ ] (Opcional) ACL Tailscale restringindo cada relé à porta do seu tenant.
- [ ] Rotação dos segredos GCP/Tailscale que apareceram no chat.
