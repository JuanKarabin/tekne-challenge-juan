import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';

const navItems = [
  { label: 'Dashboard', path: '/' },
  { label: 'Policies', path: '/policies' },
  { label: 'Upload', path: '/upload' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Link
            component={RouterLink}
            to="/"
            variant="h6"
            sx={{
              flexGrow: 1,
              color: '#FEDB7C',
              fontWeight: 'bold',
              textDecoration: 'none',
              '&:hover': { color: '#FEDB7C', textDecoration: 'none', opacity: 0.9 },
            }}
          >
            Tekne Challenge
          </Link>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {navItems.map(({ label, path }) => (
              <Button
                key={path}
                color="inherit"
                component={RouterLink}
                to={path}
                variant={location.pathname === path ? 'outlined' : 'text'}
                sx={{ 
                  color: '#FFFEF1',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 254, 241, 0.1)',
                  },
                  ...(location.pathname === path && {
                    borderColor: '#FFFEF1',
                  }),
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>
      <main>
        <Outlet />
      </main>
    </>
  );
}
