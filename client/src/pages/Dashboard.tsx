import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import { getSummary } from "../services/api";
import type { PolicySummary } from "../services/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function Dashboard() {
  const [data, setData] = useState<PolicySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSummary()
      .then((res: any) => {
        if (!cancelled) {
          const actualData = res.data ? res.data : res;
          setData(actualData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setError("Error cargando el resumen.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={4}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const countByStatus = data?.count_by_status ?? {};
  const premiumByType = data?.premium_by_type ?? {};
  const statusLabels: Record<string, string> = { active: "Active", expired: "Expired", cancelled: "Cancelled" };

  const cardSx = {
    minHeight: 160,
    borderRadius: 2,
    backgroundColor: "#FFFEF1",
    border: "2px solid",
    borderColor: "#FEC32D",
    boxShadow: "0 4px 12px rgba(254, 195, 45, 0.15)",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
    "&:hover": {
      transform: "translateY(-8px)",
      boxShadow: "0 12px 28px rgba(254, 97, 45, 0.2), 0 4px 12px rgba(254, 195, 45, 0.2)",
      borderColor: "#FE612D",
    },
  };

  const cardContentSx = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const cardTitleSx = {
    letterSpacing: 1,
    fontWeight: 600,
    color: "#FE612D",
    fontSize: "1.05rem",
  };

  return (
    <Box p={3} sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Typography variant="h4" gutterBottom sx={{ alignSelf: "flex-start" }}>
        Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2, alignSelf: "flex-start" }}>
        Summary
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 3,
          maxWidth: 900,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <Card sx={cardSx}>
          <CardContent sx={cardContentSx}>
            <Typography variant="overline" sx={cardTitleSx}>
              Total Policies
            </Typography>
            <Typography variant="h4" fontWeight="bold" color="text.primary">
              {data?.total_policies ?? 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent sx={cardContentSx}>
            <Typography variant="overline" sx={cardTitleSx}>
              Total Premium (USD)
            </Typography>
            <Typography variant="h4" fontWeight="bold" color="text.primary">
              {formatCurrency(data?.total_premium_usd ?? 0)}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent sx={cardContentSx}>
            <Typography variant="overline" sx={cardTitleSx}>
              Count by Status
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, mt: 0.5 }}>
              {(["active", "expired", "cancelled"] as const).map((key) => (
                <li key={key}>
                  <Typography variant="body1" sx={{ fontSize: "1rem" }}>
                    <strong>{statusLabels[key]}</strong>: {countByStatus[key] ?? 0}
                  </Typography>
                </li>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent sx={cardContentSx}>
            <Typography variant="overline" sx={cardTitleSx}>
              Premium by Type
            </Typography>
            {Object.keys(premiumByType).length === 0 ? (
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: "1rem" }}>
                No hay datos
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2.5, mt: 0.5 }}>
                {Object.entries(premiumByType).map(([policyType, totalPremium]) => (
                  <li key={policyType}>
                    <Typography variant="body1" sx={{ fontSize: "1rem" }}>
                      <strong>{policyType}</strong>: {formatCurrency(Number(totalPremium))}
                    </Typography>
                  </li>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}